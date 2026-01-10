#include <bits/stdc++.h>
using namespace std;

int main() {
    double p;
    cin >> p;
    cout << fixed << p + (1-p)*p + (1-p)*(1-p)*p << endl;
}