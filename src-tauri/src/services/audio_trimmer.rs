//! Audio trimming service for removing trailing silence from MP3 files.
//!
//! Pure Rust implementation using symphonia for decoding and mp3lame-encoder for encoding.
//! Matches the behavior of the macOS SilenceTrimmingService.swift

use mp3lame_encoder::{Builder, FlushNoGap, InterleavedPcm};
use std::io::Cursor;
use std::mem::MaybeUninit;
use symphonia::core::audio::{AudioBufferRef, Signal};
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use thiserror::Error;

const WINDOW_MS: f64 = 10.0; // ffmpeg default efectivo

/// Configuration for silence trimming (matches macOS implementation)
#[derive(Debug, Clone)]
pub struct TrimConfig {
    /// Silence threshold in dB (e.g., -40.0)
    pub silence_threshold_db: f64,
    /// Minimum duration of silence to detect (in seconds)
    pub min_silence_duration_secs: f64,
    /// Amount of audio to keep after content ends (in seconds)
    pub tail_padding_secs: f64,
    /// Fade-out duration at the end (in seconds)
    pub fade_out_secs: f64,
    /// Absolute silence to append at the end (in seconds)
    pub silence_padding_secs: f64,
}

impl Default for TrimConfig {
    fn default() -> Self {
        Self {
            silence_threshold_db: -40.0,
            min_silence_duration_secs: 0.3, // 300ms
            tail_padding_secs: 0.15,        // 150ms
            fade_out_secs: 0.08,            // 80ms
            silence_padding_secs: 0.08,     // 80ms
        }
    }
}

impl TrimConfig {
    /// Convert dB threshold to linear amplitude
    fn threshold_linear(&self) -> f32 {
        (10.0_f64).powf(self.silence_threshold_db / 20.0) as f32
    }
}

#[derive(Debug, Error)]
pub enum AudioTrimError {
    #[error("Failed to decode MP3: {0}")]
    DecodeError(String),
    #[error("Failed to encode MP3: {0}")]
    EncodeError(String),
    #[error("No audio track found")]
    NoAudioTrack,
    #[error("Unsupported sample format")]
    UnsupportedFormat,
    #[error("No significant trailing silence detected")]
    NoSignificantSilence,
}

/// Decoded PCM audio data
struct PcmData {
    samples: Vec<f32>,
    sample_rate: u32,
    channels: usize,
}

/// Decode MP3 bytes to PCM samples
fn decode_mp3(mp3_bytes: &[u8]) -> Result<PcmData, AudioTrimError> {
    let cursor = Cursor::new(mp3_bytes.to_vec());
    let mss = MediaSourceStream::new(Box::new(cursor), Default::default());

    let mut hint = Hint::new();
    hint.with_extension("mp3");

    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| AudioTrimError::DecodeError(format!("Probe failed: {}", e)))?;

    let mut format = probed.format;

    // Find the first audio track
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or(AudioTrimError::NoAudioTrack)?;

    let track_id = track.id;
    let sample_rate = track
        .codec_params
        .sample_rate
        .ok_or_else(|| AudioTrimError::DecodeError("No sample rate".into()))?;
    let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2);

    let decoder_opts = DecoderOptions::default();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .map_err(|e| AudioTrimError::DecodeError(format!("Decoder creation failed: {}", e)))?;

    let mut all_samples: Vec<f32> = Vec::new();

    // Decode all packets
    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(e) => {
                return Err(AudioTrimError::DecodeError(format!(
                    "Packet read error: {}",
                    e
                )));
            }
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(e) => {
                return Err(AudioTrimError::DecodeError(format!("Decode error: {}", e)));
            }
        };

        // Convert to f32 samples (interleaved)
        match decoded {
            AudioBufferRef::F32(buf) => {
                for frame in 0..buf.frames() {
                    for ch in 0..channels {
                        all_samples.push(*buf.chan(ch).get(frame).unwrap_or(&0.0));
                    }
                }
            }
            AudioBufferRef::S16(buf) => {
                for frame in 0..buf.frames() {
                    for ch in 0..channels {
                        let sample = *buf.chan(ch).get(frame).unwrap_or(&0);
                        all_samples.push(sample as f32 / 32768.0);
                    }
                }
            }
            AudioBufferRef::S32(buf) => {
                for frame in 0..buf.frames() {
                    for ch in 0..channels {
                        let sample = *buf.chan(ch).get(frame).unwrap_or(&0);
                        all_samples.push(sample as f32 / 2147483648.0);
                    }
                }
            }
            AudioBufferRef::U8(buf) => {
                for frame in 0..buf.frames() {
                    for ch in 0..channels {
                        let sample = *buf.chan(ch).get(frame).unwrap_or(&128);
                        all_samples.push((sample as f32 - 128.0) / 128.0);
                    }
                }
            }
            _ => return Err(AudioTrimError::UnsupportedFormat),
        }
    }

    Ok(PcmData {
        samples: all_samples,
        sample_rate,
        channels,
    })
}

fn detect_trailing_silence(
    samples: &[f32],
    channels: usize,
    sample_rate: u32,
    config: &TrimConfig,
) -> Option<usize> {
    let threshold = config.threshold_linear();

    let window_size = ((sample_rate as f64 * WINDOW_MS / 1000.0).round() as usize).max(1);
    let total_frames = samples.len() / channels;

    if total_frames == 0 {
        return None;
    }

    let mut silence_regions: Vec<(usize, Option<usize>)> = Vec::new();
    let mut current_silence_start: Option<usize> = None;

    let mut frame = 0;

    while frame + window_size <= total_frames {
        let mut sum = 0.0f32;
        let mut count = 0;

        for f in frame..(frame + window_size) {
            let base = f * channels;
            for ch in 0..channels {
                let v = samples.get(base + ch).copied().unwrap_or(0.0);
                sum += v * v;
                count += 1;
            }
        }

        let rms = (sum / count as f32).sqrt();

        if rms <= threshold {
            if current_silence_start.is_none() {
                current_silence_start = Some(frame);
            }
        } else if let Some(start) = current_silence_start.take() {
            silence_regions.push((start, Some(frame)));
        }

        frame += window_size;
    }

    // Silence reaching EOF
    if let Some(start) = current_silence_start {
        silence_regions.push((start, None));
    }

    // Minimum silence duration (seconds)
    let min_silence_frames = (config.min_silence_duration_secs * sample_rate as f64) as usize;

    // Find trailing silence region
    let trailing = silence_regions.iter().find(|(start, end)| {
        let end_frame = end.unwrap_or(total_frames);
        end_frame >= total_frames && (end_frame - *start) >= min_silence_frames
    })?;

    let silence_start_frame = trailing.0;

    let tail_padding_frames = (config.tail_padding_secs * sample_rate as f64) as usize;

    let trim_frame = (silence_start_frame + tail_padding_frames).min(total_frames);

    Some(trim_frame * channels)
}

/// Apply linear fade-out to samples
fn apply_fade_out(samples: &mut [f32], channels: usize, sample_rate: u32, fade_duration_secs: f64) {
    let fade_frames = (fade_duration_secs * sample_rate as f64) as usize;
    let total_frames = samples.len() / channels;

    if fade_frames == 0 || total_frames == 0 {
        return;
    }

    let fade_start_frame = total_frames.saturating_sub(fade_frames);

    for frame in fade_start_frame..total_frames {
        let progress = (frame - fade_start_frame) as f64 / fade_frames as f64;
        let gain = (1.0 - progress) as f32;

        let frame_start = frame * channels;
        for ch in 0..channels {
            if let Some(sample) = samples.get_mut(frame_start + ch) {
                *sample *= gain;
            }
        }
    }
}

/// Encode PCM samples to MP3
fn encode_mp3(
    samples: &[f32],
    sample_rate: u32,
    channels: usize,
) -> Result<Vec<u8>, AudioTrimError> {
    let samples_i16: Vec<i16> = samples
        .iter()
        .map(|&s| (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
        .collect();

    let mut builder = Builder::new()
        .ok_or_else(|| AudioTrimError::EncodeError("Failed to create LAME builder".into()))?;

    builder
        .set_num_channels(channels as u8)
        .map_err(|e| AudioTrimError::EncodeError(format!("{:?}", e)))?;

    builder
        .set_sample_rate(sample_rate)
        .map_err(|e| AudioTrimError::EncodeError(format!("{:?}", e)))?;

    builder
        .set_quality(mp3lame_encoder::Quality::Best)
        .map_err(|e| AudioTrimError::EncodeError(format!("{:?}", e)))?;

    let mut encoder = builder
        .build()
        .map_err(|e| AudioTrimError::EncodeError(format!("{:?}", e)))?;

    let frames_per_block = 1152;
    let mut output = Vec::<u8>::new();

    // Buffer de salida para LAME
    let mut lame_buffer: Vec<MaybeUninit<u8>> = vec![MaybeUninit::uninit(); 8192];

    for chunk in samples_i16.chunks(frames_per_block * channels) {
        let pcm = InterleavedPcm(chunk);

        let bytes_written = encoder
            .encode(pcm, &mut lame_buffer)
            .map_err(|e| AudioTrimError::EncodeError(format!("{:?}", e)))?;

        // Copiar SOLO los bytes inicializados
        let initialized =
            unsafe { std::slice::from_raw_parts(lame_buffer.as_ptr() as *const u8, bytes_written) };

        output.extend_from_slice(initialized);
    }

    let flush_bytes = encoder
        .flush::<FlushNoGap>(&mut lame_buffer)
        .map_err(|e| AudioTrimError::EncodeError(format!("{:?}", e)))?;

    if flush_bytes > 0 {
        let initialized =
            unsafe { std::slice::from_raw_parts(lame_buffer.as_ptr() as *const u8, flush_bytes) };
        output.extend_from_slice(initialized);
    }

    Ok(output)
}

/// Trim trailing silence from MP3 audio
///
/// Algorithm (matching macOS SilenceTrimmingService):
/// 1. Decode MP3 to PCM samples
/// 2. Detect trailing silence (silence that extends to EOF)
/// 3. Trim at silence_start + tail_padding
/// 4. Apply fade-out
/// 5. Append silence padding
/// 6. Re-encode to MP3
pub fn trim_trailing_silence(
    mp3_bytes: Vec<u8>,
    config: &TrimConfig,
) -> Result<Vec<u8>, AudioTrimError> {
    let original_len = mp3_bytes.len();

    // Decode MP3
    let pcm = decode_mp3(&mp3_bytes)?;
    let sample_rate = pcm.sample_rate;
    let channels = pcm.channels;
    let mut samples = pcm.samples;

    if samples.is_empty() {
        println!("[trim_trailing_silence] Empty audio, returning original");
        return Ok(mp3_bytes);
    }

    let original_frames = samples.len() / channels;
    let original_duration_secs = original_frames as f64 / sample_rate as f64;

    // Detect trailing silence
    let trim_point = match detect_trailing_silence(&samples, channels, sample_rate, config) {
        Some(point) => point,
        None => {
            println!(
                "[trim_trailing_silence] No significant trailing silence detected (duration={:.2}s)",
                original_duration_secs
            );
            return Err(AudioTrimError::NoSignificantSilence);
        }
    };

    // Check if trim would remove less than 100ms (not worth re-encoding)
    let would_trim_frames = original_frames - (trim_point / channels);
    let would_trim_secs = would_trim_frames as f64 / sample_rate as f64;

    if would_trim_secs < 0.1 {
        println!(
            "[trim_trailing_silence] Would only trim {:.2}s, not significant enough",
            would_trim_secs
        );
        return Err(AudioTrimError::NoSignificantSilence);
    }

    // Truncate samples
    samples.truncate(trim_point);

    if samples.is_empty() {
        println!("[trim_trailing_silence] Trimmed to empty, returning original");
        return Ok(mp3_bytes);
    }

    // Apply fade-out
    apply_fade_out(&mut samples, channels, sample_rate, config.fade_out_secs);

    // Append silence padding
    let silence_frames = (config.silence_padding_secs * sample_rate as f64) as usize;
    let silence_samples = silence_frames * channels;
    samples.extend(std::iter::repeat_n(0.0f32, silence_samples));

    let trimmed_frames = samples.len() / channels;
    let trimmed_duration_secs = trimmed_frames as f64 / sample_rate as f64;

    println!(
        "[trim_trailing_silence] Trimmed: {:.2}s -> {:.2}s (removed {:.2}s)",
        original_duration_secs,
        trimmed_duration_secs,
        original_duration_secs - trimmed_duration_secs
    );

    // Encode back to MP3
    let result = encode_mp3(&samples, sample_rate, channels)?;

    println!(
        "[trim_trailing_silence] Encoded: {} -> {} bytes",
        original_len,
        result.len()
    );

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = TrimConfig::default();
        assert_eq!(config.silence_threshold_db, -40.0);
        assert!((config.min_silence_duration_secs - 0.3).abs() < 0.001);
    }

    #[test]
    fn test_threshold_linear() {
        let config = TrimConfig::default();
        let linear = config.threshold_linear();
        // -40dB should be approximately 0.01
        assert!((linear - 0.01).abs() < 0.001);
    }
}
