/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-extraneous-dependencies */

import 'vtk.js/Sources/favicon';

import macro from 'vtk.js/Sources/macro';
import HttpDataAccessHelper from 'vtk.js/Sources/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkColorMaps from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction/ColorMaps';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkImageCroppingWidget from 'vtk.js/Sources/Widgets/Widgets3D/ImageCroppingWidget';
import vtkImageCropFilter from 'vtk.js/Sources/Filters/General/ImageCropFilter';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkURLExtract from 'vtk.js/Sources/Common/Core/URLExtract';
import vtkXMLPolyDataReader from 'vtk.js/Sources/IO/XML/XMLPolyDataReader';
import vtkFPSMonitor from 'vtk.js/Sources/Interaction/UI/FPSMonitor';
import vtkOutlineFilter from 'vtk.js/Sources/Filters/General/OutlineFilter';

import {
  ColorMode,
  ScalarMode,
} from 'vtk.js/Sources/Rendering/Core/Mapper/Constants';

import style from './GeometryViewer.module.css';
import icon from './favicon.ico';

let autoInit = true;
let background = [0.89, 0.89, 0.89];
let renderWindow;
let renderer;

global.pipeline = {};

// Process arguments from URL
const userParams = vtkURLExtract.extractURLParameters();

// Background handling
if (userParams.background) {
  background = userParams.background.split(',').map((s) => Number(s));
}
const selectorClass =
  background.length === 3 && background.reduce((a, b) => a + b, 0) < 1.5
    ? style.dark
    : style.light;

// lut
const lutName = userParams.lut || 'erdc_rainbow_bright';

// field
const field = userParams.field || '';

// camera
function updateCamera(camera) {
  ['zoom', 'pitch', 'elevation', 'yaw', 'azimuth', 'roll', 'dolly'].forEach(
    (key) => {
      if (userParams[key]) {
        camera[key](userParams[key]);
      }
      renderWindow.render();
    }
  );
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// ----------------------------------------------------------------------------
// DOM containers for UI control
// ----------------------------------------------------------------------------

const rootControllerContainer = document.createElement('div');
rootControllerContainer.setAttribute('class', style.rootController);

const addDataSetButton = document.createElement('img');
addDataSetButton.setAttribute('class', style.button);
addDataSetButton.setAttribute('src', icon);
addDataSetButton.addEventListener('click', () => {
  const isVisible = rootControllerContainer.style.display !== 'none';
  rootControllerContainer.style.display = isVisible ? 'none' : 'flex';
});

const fpsMonitor = vtkFPSMonitor.newInstance();
const fpsElm = fpsMonitor.getFpsMonitorContainer();
fpsElm.classList.add(style.fpsMonitor);

// ----------------------------------------------------------------------------
// Add class to body if iOS device
// ----------------------------------------------------------------------------

const iOS = /iPad|iPhone|iPod/.test(window.navigator.platform);

if (iOS) {
  document.querySelector('body').classList.add('is-ios-device');
}

// ----------------------------------------------------------------------------

function emptyContainer(container) {
  fpsMonitor.setContainer(null);
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

// ----------------------------------------------------------------------------

function createViewer(container) {
  const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
    background,
    rootContainer: container,
    containerStyle: { height: '100%', width: '100%', position: 'absolute' },
  });
  renderer = fullScreenRenderer.getRenderer();
  renderWindow = fullScreenRenderer.getRenderWindow();
  renderWindow.getInteractor().setDesiredUpdateRate(15);

  container.appendChild(rootControllerContainer);
  container.appendChild(addDataSetButton);

  if (userParams.fps) {
    if (Array.isArray(userParams.fps)) {
      fpsMonitor.setMonitorVisibility(...userParams.fps);
      if (userParams.fps.length === 4) {
        fpsMonitor.setOrientation(userParams.fps[3]);
      }
    }
    fpsMonitor.setRenderWindow(renderWindow);
    fpsMonitor.setContainer(container);
    fullScreenRenderer.setResizeCallback(fpsMonitor.update);
  }
}

// ----------------------------------------------------------------------------

function createPipeline(fileName, fileContents) {

  // --- Set up the cone actor ---
  const actor = vtkActor.newInstance();
  const mapper = vtkMapper.newInstance();

  // set up outline filter
  const outlineActor = vtkActor.newInstance();
  const outlineMapper = vtkMapper.newInstance();

  // VTP pipeline
  const vtpReader = vtkXMLPolyDataReader.newInstance();
  console.log(fileContents);
  vtpReader.parseAsArrayBuffer(fileContents);

  // --- set up our filter
  const filter = vtkOutlineFilter.newInstance();

  // coneSource -> filter
  filter.setInputConnection(vtpReader.getOutputPort());

  // mapper to the object it self
  mapper.setInputConnection(vtpReader.getOutputPort());
  // filter -> mapper
  outlineMapper.setInputConnection(filter.getOutputPort());

  // tell the actor which mapper to use
  actor.setMapper(mapper);
  outlineActor.setMapper(outlineMapper);


  renderer.addActor(actor);
  renderer.addActor(outlineActor);

  renderer.resetCamera();
  renderWindow.render();

  filter.onModified(() => {
    renderWindow.render();
  });
}

// ----------------------------------------------------------------------------

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = function onLoad(e) {
    console.log(file.name, reader.result);
    createPipeline(file.name, reader.result);
  };
  reader.readAsArrayBuffer(file);
}

// ----------------------------------------------------------------------------

export function load(container, options) {
  autoInit = false;
  emptyContainer(container);
  console.log(options);

  if (options.files) {
    createViewer(container);
    console.log('files')
    let count = options.files.length;
    while (count--) {
      loadFile(options.files[count]);
    }
    updateCamera(renderer.getActiveCamera());
  } else if (options.fileURL) {
    console.log('fileUrl')
    const urls = [].concat(options.fileURL);
    const progressContainer = document.createElement('div');
    progressContainer.setAttribute('class', style.progress);
    container.appendChild(progressContainer);

    const progressCallback = (progressEvent) => {
      if (progressEvent.lengthComputable) {
        const percent = Math.floor(
          (100 * progressEvent.loaded) / progressEvent.total
        );
        progressContainer.innerHTML = `Loading ${percent}%`;
      } else {
        progressContainer.innerHTML = macro.formatBytesToProperUnit(
          progressEvent.loaded
        );
      }
    };

    createViewer(container);
    const nbURLs = urls.length;
    let nbLoadedData = 0;

    /* eslint-disable no-loop-func */
    while (urls.length) {
      const url = urls.pop();
      const name = Array.isArray(userParams.name)
        ? userParams.name[urls.length]
        : `Data ${urls.length + 1}`;
      console.log(url)
      HttpDataAccessHelper.fetchBinary(url, {
        progressCallback,
      }).then((binary) => {
        nbLoadedData++;
        if (nbLoadedData === nbURLs) {
          container.removeChild(progressContainer);
        }
        createPipeline(name, binary);
        updateCamera(renderer.getActiveCamera());
      });
    }
  }
}

export function initLocalFileLoader(container) {
  const exampleContainer = document.querySelector('.content');
  const rootBody = document.querySelector('body');
  const myContainer = container || exampleContainer || rootBody;

  if (myContainer !== container) {
    myContainer.classList.add(style.fullScreen);
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  } else {
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  }

  const fileContainer = document.createElement('div');
  fileContainer.innerHTML = `<div class="${style.bigFileDrop}"/><input type="file" multiple accept=".vtp" style="display: none;"/>`;
  myContainer.appendChild(fileContainer);

  const fileInput = fileContainer.querySelector('input');

  function handleFile(e) {
    preventDefaults(e);
    const dataTransfer = e.dataTransfer;
    const files = e.target.files || dataTransfer.files;
    if (files.length > 0) {
      myContainer.removeChild(fileContainer);
      load(myContainer, { files });
    }
  }

  fileInput.addEventListener('change', handleFile);
  fileContainer.addEventListener('drop', handleFile);
  fileContainer.addEventListener('click', (e) => fileInput.click());
  fileContainer.addEventListener('dragover', preventDefaults);
}

// Look at URL an see if we should load a file
// ?fileURL=https://data.kitware.com/api/v1/item/59cdbb588d777f31ac63de08/download
if (userParams.url || userParams.fileURL) {
  const exampleContainer = document.querySelector('.content');
  const rootBody = document.querySelector('body');
  const myContainer = exampleContainer || rootBody;

  if (myContainer) {
    myContainer.classList.add(style.fullScreen);
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  }

  load(myContainer, userParams);
}

// Auto setup if no method get called within 100ms
setTimeout(() => {
  if (autoInit) {
    initLocalFileLoader();
  }
}, 100);
