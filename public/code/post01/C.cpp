#include <bits/stdc++.h>
using namespace std;

int ask(vector<int>& ans, int pos, int value) {
    cout << '?';
    for (int i = 1; i < ans.size(); ++i) {
        if (i == pos) cout << ' ' << value;
        else          cout << ' ' << ans[i];
    }
    cout << endl << flush;

    int ret;
    cin >> ret;
    return ret;
}

void output_answer(vector<int>& ans) {
    cout << '!';
    for (int i = 1; i < ans.size(); ++i)
        cout << ' ' << ans[i];
    cout << endl << flush;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int T;
    cin >> T;

    while (T--) {
        int n;
        cin >> n;

        vector<int> ans(n + 1, 0);
        vector<bool> vis(n + 1, false);

        int ok = 0;

        for (int value = 1; value <= n; ++value) {
            for (int pos = 1; pos <= n; ++pos) {
                if (vis[pos]) continue;

                int res = ask(ans, pos, value);
                if (res != ok) {
                    ans[pos] = value;
                    vis[pos] = true;
                    ++ok;
                    break;
                }
            }
        }

        output_answer(ans);
    }
}
