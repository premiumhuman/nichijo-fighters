// 旧Lv5(コミット 26fbdf2 時点の「めっちゃつよい」)を Lv8 として追加。新機能のパラメータなし + noLow(Lv1〜3用の大振り対策AIも使わない) = 旧コードと同じ動き
N.CPU_LV[8] = { name: '旧Lv5', react: [12, 2], interval: [7, 11], err: 12, mistake: 0.05, guard: 0.76, punish: 0.76, read: 0.78, recov: 0.98, aggro: 0.66, superUse: 0.8, noLow: true };
