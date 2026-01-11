#include <iostream>
#include <vector>

using namespace std;

int rows, cols;
vector<vector<int>> vis;

const int dx[4] = {0, 0, -1, 1};
const int dy[4] = {1, -1, 0, 0};

bool dfs(int x, int y) {
    if (y == rows + 1) return true;

    vis[y][x] = 1;

    for (int i = 0; i < 4; ++i) {
        int nx = x + dx[i];
        int ny = y + dy[i];

        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows + 2) {
            if (!vis[ny][nx]) {
                if (dfs(nx, ny)) return true;
            }
        }
    }
    
    return false;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    cin >> rows >> cols;
    vis.assign(rows + 2, vector<int>(cols, 0));

    for (int i = 1; i <= rows; ++i) {
        int n; char m;
        cin >> n >> m;
        if (m == 'R') {
            for (int j = n - 1; j < cols; ++j) vis[i][j] = 1;
        } else {
            for (int j = n - 1; j >= 0; --j) vis[i][j] = 1;
        }
    }

    if (dfs(0, 0)) cout << "YES" << endl;
    else cout << "NO" << endl;

    return 0;
}