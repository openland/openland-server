./use-server-workers.sh
kubectl delete secret openland-config
kubectl create secret generic openland-config --from-file=./config.json

./use-server-us-west1.sh
kubectl delete secret openland-config
kubectl create secret generic openland-config --from-file=./config.json

./use-old.sh
kubectl delete secret openland-config
kubectl create secret generic openland-config --from-file=./config.json