/*
@author : isank dev
@linkch : https://whatsapp.com/channel/0029Vb8Fj4S1iUxiJPyKFh1U
@note : informasi update nya lewat ch
@tanggal : now
*/

"use strict";

const { Toolkit } = require("./toolkit.js");
const { Button } = require("./button.js");
const { ButtonV2 } = require("./button-v2.js");
const { Carousel } = require("./carousel.js");
const { AIRich } = require("./ai-rich.js");
const { bind, sendLinkPreview } = require("./link-preview.js");
const { sendLivePhoto } = require("./live-photo.js");
const { sendLiveThumbnail } = require("./live-thumbnail.js");
const { bx } = require("./quick.js");

const VERSION = "2.1.0";

module.exports = {
  VERSION,
  Button,
  ButtonV2,
  Carousel,
  AIRich,
  Toolkit,
  bind,
  sendLinkPreview,
  sendLivePhoto,
  sendLiveThumbnail,
  bx
};
