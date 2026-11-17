# Capstone — disk + ISR + stuck consume

1. Delete `debug.dump` to free **kafka-1**.
2. Run `~/bin/drain-dispatch-desk.sh` (or consume as `dispatch-desk`) so lag falls by reading.
3. Refuse min.ISR=1, unclean election, and reset-to-latest.
