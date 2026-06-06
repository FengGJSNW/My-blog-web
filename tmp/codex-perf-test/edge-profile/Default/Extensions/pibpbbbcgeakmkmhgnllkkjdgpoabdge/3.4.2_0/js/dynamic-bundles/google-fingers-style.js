(() => {var styleTag = document.createElement('style'); styleTag.id = 'stylish-dynamic-style-css-google-fingers-style'; styleTag.innerHTML = ''; document.body.appendChild(styleTag);
  window.addEventListener('message', (msg) => {
    if (msg.data && msg.data.type === 'stylish-dynamic-uninstall-google-fingers-style') {
      document.getElementById('stylish-dynamic-style-css-google-fingers-style').remove();
      document.getElementById('stylish-google-fingers-style-container').remove();
    }
  });var elem = document.createElement('div');
elem.classList.add("stylish-game-container");
elem.id = "stylish-game-container-google-fingers-style";
elem.innerHTML = '';
function isGoogle() {
  return window.location.hostname.indexOf('www.google') > -1;
}

function isGoogleSearch() {
  return isGoogle() && window.location.href.indexOf('search') > -1;
}

if (isGoogle() && !isGoogleSearch()) {
  const OFFSET_RANGE = 300;
  const RIGHT_ANGLE_WIDTH = 1282;
  const BOTTOM_ANGLE_WIDTH = 995;
  const DEFAULT_DESTINATION_OFFSET = 67;
  const imagesData = [
    {
      url: 'https://i.imgur.com/pbgRtpt.png',
      direction: 'left',
      width: 2695,
      height: 138,
      offset: 208,
    },
    {
      url: 'https://i.imgur.com/vdhDBBn.png',
      direction: 'left',
      width: 2695,
      height: 138,
      offset: 208,
    },
    {
      url: 'https://i.imgur.com/wKBPgxo.png',
      direction: 'left',
      width: 2695,
      height: 138,
      offset: 208,
    },
    {
      url: 'https://i.imgur.com/cavrRyv.png',
      direction: 'left',
      width: 2647,
      height: 135,
      offset: 70,
    },
    {
      url: 'https://i.imgur.com/ISbBOsb.png',
      direction: 'left',
      width: 2647,
      height: 135,
      offset: 70,
    },
    {
      url: 'https://i.imgur.com/lighU0J.png',
      direction: 'left',
      width: 2647,
      height: 135,
      offset: 70,
    },
    {
      url: 'https://i.imgur.com/AlxdXNK.png',
      direction: 'right',
      width: 2695,
      height: 138,
    },
    {
      url: 'https://i.imgur.com/U72vNJr.png',
      direction: 'right',
      width: 2695,
      height: 138,
    },
    {
      url: 'https://i.imgur.com/EUiSlbP.png',
      direction: 'right',
      width: 2695,
      height: 138,
    },
    {
      url: 'https://i.imgur.com/FWfRyy7.png',
      direction: 'right',
      width: 2647,
      height: 135,
    },
    {
      url: 'https://i.imgur.com/vzgEFxT.png',
      direction: 'right',
      width: 2647,
      height: 135,
    },
    {
      url: 'https://i.imgur.com/WqvRoeH.png',
      direction: 'right',
      width: 2647,
      height: 135,
    },
    {
      url: 'https://i.imgur.com/cGmQ5hn.png',
      direction: 'top',
      width: 134,
      height: 2644,
    },
    {
      url: 'https://i.imgur.com/EPpJbqI.png',
      direction: 'top',
      width: 134,
      height: 2644,
    },
    {
      url: 'https://i.imgur.com/ynfdDa7.png',
      direction: 'top',
      width: 134,
      height: 2644,
    },
    {
      url: 'https://i.imgur.com/glna8OV.png',
      direction: 'top',
      width: 134,
      height: 2705,
    },
    {
      url: 'https://i.imgur.com/BJU1xUZ.png',
      direction: 'top',
      width: 134,
      height: 2705,
    },
    {
      url: 'https://i.imgur.com/y9xB1HY.png',
      direction: 'top',
      width: 134,
      height: 2705,
    },
    {
      url: 'https://i.imgur.com/B5UewZe.png',
      direction: 'bottom',
      width: 134,
      height: 2644,
    },
    {
      url: 'https://i.imgur.com/aBNJUJR.png',
      direction: 'bottom',
      width: 134,
      height: 2644,
    },
    {
      url: 'https://i.imgur.com/iDcgXJq.png',
      direction: 'bottom',
      width: 134,
      height: 2644,
    },
    {
      url: 'https://i.imgur.com/gHcPPpW.png',
      direction: 'bottom',
      width: 134,
      height: 2705,
    },
    {
      url: 'https://i.imgur.com/Jcj7LhH.png',
      direction: 'bottom',
      width: 134,
      height: 2705,
    },
    {
      url: 'https://i.imgur.com/b0K9MyR.png',
      direction: 'bottom',
      width: 134,
      height: 2705,
    },
  ];

  function calcAngle(x1, y1, x2, y2) {
    // Calculate the angle between the two points
    const angle = Math.atan2(y2 - y1, x2 - x1);
    // Convert the angle to degrees
    const angleDegrees = (angle * 180) / Math.PI;
    return angleDegrees;
  }

  function randImage() {
    const rand = Math.floor(Math.random() * imagesData.length);
    return imagesData[rand];
  }

  function createFinger(url) {
    const finger = document.createElement('img');
    finger.src = url;
    finger.style.position = 'absolute';
    finger.style.opacity = '1';
    finger.style.zIndex = 99999;
    finger.style.transition = `all 0.5s`;
    finger.style.opacity = '1';
    return finger;
  }

  function getFingerAngle(startX, startY, clientX, clientY, direction) {
    let angle = 0;

    if (direction === 'left' || direction === 'top') {
      angle = calcAngle(startX, startY, clientX, clientY);
    } else if (direction === 'right') {
      angle = calcAngle(window.innerWidth + RIGHT_ANGLE_WIDTH, startY, clientX, clientY);
    } else if (direction === 'bottom') {
      angle = calcAngle(startX, window.innerHeight + BOTTOM_ANGLE_WIDTH, clientX, clientY);
    }

    if (direction === 'right' || direction === 'bottom1') {
      if (angle < -90) {
        angle += 180;
      } else if (angle > 90) {
        angle -= 180;
      }
    } else if (direction === 'top') {
      angle -= 90;
    } else if (direction === 'bottom') {
      angle += 90;
    }

    return angle;
  }

  function setFingerDestination(direction, finger, clientX, clientY, initialPositionOffset) {
    if (direction === 'left') {
      finger.style.left = `${clientX - finger.width + finger.height / 2}px`;
      finger.style.top = `${clientY + ((finger.height / 2) * initialPositionOffset) / OFFSET_RANGE - finger.height / 2}px`;
    } else if (direction === 'right') {
      finger.style.left = `${clientX - DEFAULT_DESTINATION_OFFSET}px`;
      finger.style.top = `${clientY + (finger.height * initialPositionOffset) / OFFSET_RANGE - finger.height / 2}px`;
    } else if (direction === 'top') {
      finger.style.top = `${clientY - finger.height + finger.width}px`;
      finger.style.left = `${clientX - DEFAULT_DESTINATION_OFFSET + (finger.width * initialPositionOffset) / OFFSET_RANGE}px`;
    } else if (direction === 'bottom') {
      finger.style.top = `${clientY - finger.width / 2}px`;
      finger.style.left = `${clientX - DEFAULT_DESTINATION_OFFSET + (2 * finger.width * initialPositionOffset) / OFFSET_RANGE}px`;
    }
  }

  function calcFingerStartPoint(direction, clientX, clientY, initialPositionOffset, imageData) {
    let startX = 0;
    let startY = 0;

    switch (direction) {
      case 'left':
        startX = -imageData.width;
        startY = Math.min(Math.max(0, clientY + initialPositionOffset), window.innerHeight);
        break;
      case 'right':
        startX = window.innerWidth - 1;
        startY = Math.min(Math.max(0, clientY + initialPositionOffset), window.innerHeight);
        break;
      case 'top':
        startX = Math.min(Math.max(0, clientX + initialPositionOffset), window.innerWidth);
        startY = -imageData.height;
        break;
      case 'bottom':
        startX = Math.min(Math.max(0, clientX + initialPositionOffset), window.innerWidth);
        startY = window.innerHeight;
        break;
    }
    return { startX, startY };
  }

  document.addEventListener('click', async (event) => {
    const { clientX, clientY } = event;
    const body = document.querySelector('body');
    const imageData = randImage();
    const direction = imageData.direction;
    const finger = createFinger(imageData.url);
    const initialPositionOffset = Math.floor(Math.random() * (2 * OFFSET_RANGE + 1)) - OFFSET_RANGE;
    const { startX, startY } = calcFingerStartPoint(direction, clientX, clientY, initialPositionOffset, imageData);
    const angle = getFingerAngle(startX, startY, clientX, clientY, direction);

    finger.style.left = startX + 'px';
    finger.style.top = startY + 'px';
    finger.style.transform = `rotate(${angle}deg)`;
    body.appendChild(finger);

    setTimeout(() => {
      setFingerDestination(direction, finger, clientX, clientY, initialPositionOffset);
      setTimeout(() => {
        finger.style.top = `${startY}px`;
        finger.style.left = `${startX}px`;
        setTimeout(() => body.removeChild(finger), 500);
      }, 500);
    }, 100);
  });
}
})()