#include <iostream>
#include <vector>
#include <set>
#include <map>

using namespace std;

// 预处理所有可能的方块放置掩码
vector<int> t_masks, l_masks;

void precompute() {
    // 定义基础形状（相对坐标）
    vector<pair<int, int>> T_base = {{0,0}, {0,1}, {0,2}, {1,1}};
    vector<pair<int, int>> L_base = {{0,0}, {1,0}, {2,0}, {2,1}};

    auto rotate = [](vector<pair<int, int>> shape) {
        for (auto& p : shape) { int tmp = p.first; p.first = p.second; p.second = -tmp; }
        return shape;
    };
    auto flip = [](vector<pair<int, int>> shape) {
        for (auto& p : shape) p.first = -p.first;
        return shape;
    };

    auto get_masks = [&](vector<pair<int, int>> shape, vector<int>& target) {
        set<int> unique_masks;
        for (int r = 0; r < 4; ++r) {
            for (int f = 0; f < 2; ++f) {
                // 尝试所有可能的偏移量
                for (int dx = -3; dx < 4; ++dx) {
                    for (int dy = -3; dy < 4; ++dy) {
                        int mask = 0;
                        bool ok = true;
                        for (auto& p : shape) {
                            int nx = p.first + dx, ny = p.second + dy;
                            if (nx >= 0 && nx < 4 && ny >= 0 && ny < 4) mask |= (1 << (nx * 4 + ny));
                            else { ok = false; break; }
                        }
                        if (ok) unique_masks.insert(mask);
                    }
                }
                shape = flip(shape);
            }
            shape = rotate(shape);
        }
        target.assign(unique_masks.begin(), unique_masks.end());
    };

    get_masks(T_base, t_masks);
    get_masks(L_base, l_masks);
}

// 记忆化存储：[mask][x][y]
int memo[1 << 16][4][4];

bool can_win(int mask, int x, int y) {
    if (memo[mask][x][y] != -1) return memo[mask][x][y];

    // 尝试放 T 形
    if (x > 0) {
        for (int m : t_masks) {
            if (!(mask & m) && !can_win(mask | m, x - 1, y)) 
                return memo[mask][x][y] = 1;
        }
    }
    // 尝试放 L 形
    if (y > 0) {
        for (int m : l_masks) {
            if (!(mask & m) && !can_win(mask | m, x, y - 1)) 
                return memo[mask][x][y] = 1;
        }
    }

    return memo[mask][x][y] = 0;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int x, y;
    cin >> x >> y;

    precompute();
    
    // 初始化记忆化数组为 -1
    for(int i = 0; i < (1 << 16); ++i)
        for(int j = 0; j < 4; ++j)
            for(int k = 0; k < 4; ++k)
                memo[i][j][k] = -1;

    cout << (can_win(0, x, y) ? "Alice" : "Bob") << endl;

    return 0;
}