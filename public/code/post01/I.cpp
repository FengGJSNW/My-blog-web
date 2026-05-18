#include <bits/stdc++.h>
using namespace std;

int main() {
    double p;
    cin >> p;
    cout << fixed << setprecision(6) << p + (1-p)*p + (1-p)*(1-p)*p << endl;
}