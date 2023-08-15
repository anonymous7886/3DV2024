```
$ apt install libboost-dev libboost-system-dev
$ git clone https://github.com/zaphoyd/websocketpp.git /tmp/websocketpp
$ mkdir build
$ g++ -o build/receive receive.cpp -lboost_system -pthread -I /tmp/websocketpp
$ ./build/recieve
```
