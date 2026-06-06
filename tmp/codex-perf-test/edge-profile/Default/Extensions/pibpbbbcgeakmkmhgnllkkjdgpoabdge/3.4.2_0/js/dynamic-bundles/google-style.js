(() => {var styleTag = document.createElement('style'); styleTag.id = 'stylish-dynamic-style-css-google-style'; styleTag.innerHTML = ''; document.body.appendChild(styleTag);
  window.addEventListener('message', (msg) => {
    if (msg.data && msg.data.type === 'stylish-dynamic-uninstall-google-style') {
      document.getElementById('stylish-dynamic-style-css-google-style').remove();
      document.getElementById('stylish-google-style-container').remove();
    }
  });var elem = document.createElement('div');
elem.classList.add("stylish-game-container");
elem.id = "stylish-game-container-google-style";
elem.innerHTML = '';
function isGoogle() {
  return window.location.hostname.indexOf('www.google') > -1;
}

function isGoogleSearch() {
  return isGoogle() && window.location.href.indexOf('search') > -1;
}

if (isGoogle() && !isGoogleSearch()) {
  const html = document.querySelector('html');
  const dir = html.getAttribute('dir');
  const body = document.querySelector('body');
  body.style.backgroundSize = 'cover';

  const images = [
    { url: 'https://i.imgur.com/x6FHR3d.png', startTime: 0, endTime: 6 },
    { url: 'https://i.imgur.com/l4oia2H.png', startTime: 6, endTime: 12 },
    { url: 'https://i.imgur.com/faFczMK.png', startTime: 12, endTime: 15 },
    { url: 'https://i.imgur.com/Xeegxab.png', startTime: 15, endTime: 18 },
    { url: 'https://i.imgur.com/S1p1BTg.png', startTime: 18, endTime: 21 },
    { url: 'https://i.imgur.com/CqXtO3H.png', startTime: 21, endTime: 24 },
  ];

  function createNewBackgroundImage(url, zIndex) {
    const image = new Image(); 
    image.src = url; 
    image.style.position = 'fixed';
    image.style.left = '0';
    image.style.top = '0';
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = 'fill';
    image.style.zIndex = zIndex;

    return image;
  }

  function runOnNextHour(func) {
    const now = new Date();
    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    const timeToNextHour = nextHour - now;    
    setTimeout(function () {
      func();
      setInterval(func, 60 * 60 * 1000);
    }, timeToNextHour);
  }

  function addFadeOutStyle() {
    const style = document.createElement('style');
    style.textContent = `
    .bg-fade-out {
      opacity: 1;
      transition: opacity 2s linear;
    }

    .bg-fade-out.hide {
      opacity: 0;
    }
    `;

    document.head.appendChild(style);
  }

  function addImageByTime() {
    const currentHour = new Date().getHours(); // Get current hour
    const currentItem = images.find((item) => currentHour >= item.startTime && currentHour < item.endTime);
    const imageUrl = currentItem.url;

    const body = document.querySelector('body');
    const currentImage = document.getElementById('dynamic-image-current'); // Get current image element

    const zIndex = (currentImage && currentImage.style.zIndex - 1) || -2;
    const newBackgroundImage = createNewBackgroundImage(imageUrl, zIndex);
    newBackgroundImage.id = 'dynamic-image-current'; // Set new image ID for future reference
    const lastDisplayedImage = parseInt(localStorage.getItem('currentImageTime')) || 0;

    let callback = () => {
      body.appendChild(newBackgroundImage);
      if (currentImage) {
        currentImage.classList.add('bg-fade-out');
        currentImage.classList.add('hide');
        setTimeout(() => {
          body.removeChild(currentImage);
        }, 2000);
      } else if (lastDisplayedImage !== currentItem.startTime) {
        const previousItem = images.find((item) => lastDisplayedImage >= item.startTime && lastDisplayedImage < item.endTime);
        const previousBackgroundImage = createNewBackgroundImage(previousItem.url, -2);
        previousBackgroundImage.classList.add('bg-fade-out');
        body.appendChild(previousBackgroundImage);

        setTimeout(() => {
          previousBackgroundImage.classList.add('hide');
          setTimeout(() => {
            body.removeChild(previousBackgroundImage);
          }, 2000);
        }, 500);
      }
    };

    newBackgroundImage.addEventListener('load', callback);
    localStorage.setItem('currentImageTime', currentItem.startTime);
  }

  addFadeOutStyle();
  addImageByTime();
  runOnNextHour(addImageByTime);

  ///////////////Element Css design
  // Google Icon
  const googleImage = document.querySelector('.lnXdpd');
  if (googleImage) {
    googleImage.src = 'https://i.imgur.com/PInetUh.png';
    googleImage.srcset = 'https://i.imgur.com/PInetUh.png';
  }

  // Search Icon
  const searchIconSpan = document.querySelector('.QCzoEc');
  const searchIcon = new Image();
  searchIcon.width = 19;
  searchIcon.height = 19;
  searchIcon.src = 'https://i.imgur.com/irF817S.png';
  searchIconSpan.appendChild(searchIcon);

  // Voice Search
  const voiceSearchDiv = document.querySelector('.XDyW0e');
  const voiceSearchIcon = new Image();
  voiceSearchIcon.width = 14;
  voiceSearchIcon.height = 20;
  voiceSearchIcon.src = 'https://i.imgur.com/Xs4qYGh.png';
  voiceSearchDiv.appendChild(voiceSearchIcon);

  // Image Search
  const imageSearchDiv = document.querySelector('.nDcEnd');
  const imageSearchIcon = new Image();
  imageSearchIcon.width = 20;
  imageSearchIcon.height = 20;
  imageSearchIcon.src = 'https://i.imgur.com/k2WLa18.png';
  imageSearchDiv.appendChild(imageSearchIcon);

  //Positioning arrows relatively to searchButtonsDiv
  const searchButtonsDiv = document.querySelector('.FPdoLc');
  const rightArrowImg = new Image();
  rightArrowImg.width = 165;
  rightArrowImg.height = 200;
  rightArrowImg.style.position = 'relative';
  rightArrowImg.style.top = '-365px';
  rightArrowImg.style.left = dir === 'rtl' ? '145px' : '555px';
  rightArrowImg.src = 'https://i.imgur.com/BNYtWgh.png';
  searchButtonsDiv.appendChild(rightArrowImg);
  const leftArrowImg = new Image();
  leftArrowImg.width = 307;
  leftArrowImg.height = 210;
  leftArrowImg.style.position = 'relative';
  leftArrowImg.style.top = '-271px';
  leftArrowImg.style.left = dir === 'rtl' ? '-387px' : '-427px';
  leftArrowImg.style.transform = 'rotate(-5deg)';
  leftArrowImg.src = 'https://i.imgur.com/lagpp1a.png';
  searchButtonsDiv.appendChild(leftArrowImg);
}})()