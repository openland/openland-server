type AnyFighter<T, Y, N> = 0 extends (1 & T) ? Y : N;
