(() => {var styleTag = document.createElement('style'); styleTag.id = 'stylish-dynamic-style-css-coca-google-style'; styleTag.innerHTML = ''; document.body.appendChild(styleTag);
  window.addEventListener('message', (msg) => {
    if (msg.data && msg.data.type === 'stylish-dynamic-uninstall-coca-google-style') {
      document.getElementById('stylish-dynamic-style-css-coca-google-style').remove();
      document.getElementById('stylish-coca-google-style-container').remove();
    }
  });var elem = document.createElement('div');
elem.classList.add("stylish-game-container");
elem.id = "stylish-game-container-coca-google-style";
elem.innerHTML = '';
function isGoogle() {
  return window.location.hostname.indexOf("www.google") > -1;
}

function isGoogleSearch() {
  return isGoogle() && window.location.href.indexOf("search") > -1;
}

if (isGoogle() && !isGoogleSearch()) {
  // Create the style element and set its content
  const style = document.createElement("style");
  style.innerHTML = `
  @-webkit-keyframes sunAnimation {
    from {
      -webkit-transform: rotate(0deg);
      -o-transform: rotate(0deg);
      transform: rotate(0deg);
    }
    to {
      -webkit-transform: rotate(360deg);
      -o-transform: rotate(360deg);
      transform: rotate(360deg);
    }
  }
`;

  // Append the style element to the head section of the document
  document.head.appendChild(style);

  // Create the background image element
  const sunImage = document.createElement("img");
  sunImage.src = "https://i.imgur.com/UhKm0IQ.png";
  sunImage.id = "sunImage";
  sunImage.style.zIndex = "-3";
  sunImage.style.position = "fixed";
  sunImage.style.left = "-2700px";
  sunImage.style.top = "-2700px";
  sunImage.style.animation = "sunAnimation 20s infinite linear";

  // Create the forground image element
  const flowersImg = document.createElement("img");
  flowersImg.src = "https://i.imgur.com/FYOMtQK.png";
  flowersImg.id = "flowersImg";
  flowersImg.style.zIndex = "-2";
  flowersImg.style.position = "fixed";
  flowersImg.style.left = "0";
  flowersImg.style.top = "0";
  flowersImg.style.width = "100%";
  flowersImg.style.height = "100%";
  flowersImg.style.objectFit = "fill";

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.zIndex = "-1";
  container.style.top = "0";
  container.style.left = "0";
  container.style.right = "0";
  container.style.bottom = "0";
  container.style.display = "flex";
  container.style.flexWrap = "wrap";
  container.style.justifyContent = "center";
  container.style.alignItems = "center";

  const colaSplashImg = document.createElement("img");
  colaSplashImg.src = "https://i.imgur.com/6YiPQk2.png";
  colaSplashImg.id = "colaSplashImg";
  colaSplashImg.style.width = "100%";
  colaSplashImg.style.height = "100%";
  colaSplashImg.style.objectFit = "cover";

  const div = document.createElement("div");
  div.classList.add("box");
  div.appendChild(colaSplashImg);
  container.appendChild(div);
 
  // Append the image elements to the body section of the document
  document.body.appendChild(sunImage);
  document.body.appendChild(flowersImg);
  document.body.appendChild(container);
}
})()