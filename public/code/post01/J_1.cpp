#include <bits/stdc++.h>
using namespace std;

struct Point {
    int x, y;
    Point(int x, int y) : x(x), y(y) {}
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int rows, cols;
    cin >> rows >> cols;
    vector<vector<int>> vis(rows + 2, vector<int>(cols, 0));

    for (int i = 1; i <= rows; ++i) {
        int n; char m;
        cin >> n >> m;
        if (m == 'R') {
            for (int j = n - 1; j < cols; ++j) vis[i][j] = 1;
        } else {
            for (int j = n - 1; j >= 0; --j) vis[i][j] = 1;
        }
    }

    queue<Point> qu;
    qu.emplace(0, 0); 
    vis[0][0] = 1;

    int dx[4] = {0, 0, -1, 1};
    int dy[4] = {1, -1, 0, 0};

    while (!qu.empty()) {
        Point tmp = qu.front();
        qu.pop();

        if (tmp.y == rows + 1) {
            cout << "YES" << endl;
            return 0;
        }

        for (int i = 0; i < 4; ++i) {
            int nx = tmp.x + dx[i];
            int ny = tmp.y + dy[i];

            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows + 2) {
                if (!vis[ny][nx]) {
                    vis[ny][nx] = 1;
                    qu.emplace(nx, ny);
                }
            }
        }
    }

    cout << "NO" << endl;
    return 0;
}