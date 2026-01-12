#include <bits/stdc++.h>
using namespace std;

long long gcd(long long a,long long b)
{
	if(b==0) return a;
	return gcd(b,a%b);
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    int n, k;
    cin >> n >> k;

    vector<long long> data(n);
    for(long long i = 0;i < n;++i)
        cin >> data[i];

    //生成k的因数表
    vector<long long> factor;
    for(long long i = 1;i * i <= k;++i) {
        if (k % i != 0) continue;
        factor.push_back(i);
        if (i * i != k) factor.push_back(k / i);
    }
    //根据k的因数表，生成所有gcd(x, k)的可能值，并按x分类放入表中
    vector<vector<long long>> factor_table(k+1);
    for(long long x : factor) {
        for(long long y : factor) {
            if(y % x != 0)  continue;
            factor_table[y].push_back(x);
        }
    }

    int ans = 0;
    vector<int> mark(k+1);
    //滑动窗口
    for(int l = 0, r = 0; r < n; ++r) {
        long long x = data[r];

        if(x <= k) mark[x]++;

        //根据gcd(x, k)查找预处理过后的值
        for(auto d : factor_table[gcd(x, k)]) {
            long long y = k - x + d;
            if(y <= 0 || y > k) continue;
            if(gcd(x, y) != d) continue;

            while(y <= k && mark[y] && l <= r) {
                if(data[l] <= k) mark[data[l]]--;
                l++;
            }
        }

        ans = max(ans, r - l + 1);
    }
    cout << ans;
}// 968 34600