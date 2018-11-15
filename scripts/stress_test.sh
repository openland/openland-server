cat stress_test.http | vegeta attack -rate=1000/s -duration=30s -keepalive=false | tee results.bin | vegeta report
# echo "GET http://localhost:9000/" | vegeta attack -rate=5000/s -duration=1s | tee results.bin | vegeta report
vegeta report -type=json results.bin > metrics.json
cat results.bin | vegeta plot > plot.html
cat results.bin | vegeta report -type="hist[0,100ms,200ms,300ms]"