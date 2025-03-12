const body = document.getElementsByTagName("BODY")[0];

setTimeout(function () {
    body.classList.add("loaded")
}, 1500);

// Animation scroll
function aos_init() {
    AOS.init({
      duration: 1000,
      easing: "ease",
      once: true,
      mirror: false,
    });
  }
  
  window.addEventListener('load', () => {
    aos_init();
  });