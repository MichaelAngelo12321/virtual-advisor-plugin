export function initButton(callback) {
  const btn = document.getElementById("start-button");
  btn.addEventListener("click", () => {
    callback();
  });
}
