import SwiftUI

struct BingoGridView: View {
    @Environment(AppState.self) private var appState

    private var columns: [GridItem] {
        Array(
            repeating: GridItem(.flexible(), spacing: 8),
            count: appState.selectedMode.gridColumns
        )
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(appState.selectedMode.numbers, id: \.self) { number in
                BingoCellView(number: number)
            }
        }
        .padding(.vertical)
    }
}
