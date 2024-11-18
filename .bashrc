alias gacc="gacp"

function gacp() {
  git add .
  git commit -m "$1"
  git push
}