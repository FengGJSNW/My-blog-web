#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    cout.tie(nullptr);

    int n;
    cin >> n;

    // 找到使 a + ceil(n / a) 最小的 a
    int bestA = 1;
    int bestSum = n + 1;

    for (int a = 1; a * a <= n; ++a) {
        int b = (n + a - 1) / a;
        if (a + b < bestSum) {
            bestSum = a + b;
            bestA = a;
        }
    }

    int a = bestA;
    vector<int> ans;
    ans.reserve(n);

    // 分块构造：每块倒序
    for (int i = 1; i <= n; i += a) {
        int r = min(i + a - 1, n);
        for (int j = r; j >= i; --j) {
            ans.push_back(j);
        }
    }

    // 输出结果
    for (int x : ans) {
        cout << x << " ";
    }
    cout << "\n";

    return 0;
}
