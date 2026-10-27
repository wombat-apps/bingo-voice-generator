import './SegmentedControl.css';

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <div className={`segmented-control segmented-control-${size}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented-button ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
