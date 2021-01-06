/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-extraneous-dependencies */

import 'vtk.js/Sources/favicon';

import macro from 'vtk.js/Sources/macro';
import HttpDataAccessHelper from 'vtk.js/Sources/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkColorMaps from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction/ColorMaps';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkURLExtract from 'vtk.js/Sources/Common/Core/URLExtract';
import vtkXMLPolyDataReader from 'vtk.js/Sources/IO/XML/XMLPolyDataReader';
import vtkFPSMonitor from 'vtk.js/Sources/Interaction/UI/FPSMonitor';
import vtkOutlineFilter from 'vtk.js/Sources/Filters/General/OutlineFilter';
import vtkSTLReader from 'vtk.js/Sources/IO/Geometry/STLReader';
import vtkXMLImageDataReader from 'vtk.js/Sources/IO/XML/XMLImageDataReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkAxesActor from 'vtk.js/Sources/Rendering/Core/AxesActor';
import vtkOrientationMarkerWidget from 'vtk.js/Sources/Interaction/Widgets/OrientationMarkerWidget';



import {
  ColorMode,
  ScalarMode,
} from 'vtk.js/Sources/Rendering/Core/Mapper/Constants';

import style from './GeometryViewer.module.css';
import icon from './favicon.ico';

let autoInit = true;
let background = [0.92, 0.92, 0.92];
let scaleArray = [1, 1, 1];
let renderWindow;
let renderer;

global.pipeline = {};

// Process arguments from URL (arguments such as fileURL can be passed)
const userParams = vtkURLExtract.extractURLParameters();

// Background handling
if (userParams.background) {
  background = userParams.background.split(',').map((s) => Number(s));
}

let colorTheme = background.length === 3 && background.reduce((a, b) => a + b, 0) < 1.5
  ? 'dark' : 'light';

const selectorClass =
  colorTheme === 'dark'
    ? style.dark
    : style.light;

const outlineColor = colorTheme === 'dark' ? [1, 1, 1] : [0, 0, 0]

if (userParams.scale) {
  scaleArray = userParams.scale
}
// lut
const lutName = userParams.lut || 'Viridis (matplotlib)';

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

function createOrientationAxes(interactor) {

  const initialValues = {
    config: {
      tipResolution: 60,
      tipRadius: 0.05,
      tipLength: 0.1,
      shaftResolution: 60,
      shaftRadius: 0.02,
      invert: false,
    },
    xAxisColor: [255, 0, 0],
    yAxisColor: [255, 255, 0],
    zAxisColor: [0, 128, 0],
  }
  const orientationAxes = vtkAxesActor.newInstance(initialValues)
  const orientationWidget = vtkOrientationMarkerWidget.newInstance({
    actor: orientationAxes,
    interactor: interactor,
  });

  orientationWidget.setEnabled(true);
  orientationWidget.setViewportCorner(
    vtkOrientationMarkerWidget.Corners.BOTTOM_LEFT
  );
  orientationWidget.setViewportSize(0.15);
  orientationWidget.setMinPixelSize(100);
  orientationWidget.setMaxPixelSize(300);
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

  createOrientationAxes(renderWindow.getInteractor());
}

// ----------------------------------------------------------------------------

function createPipeline(fileName, fileContents) {

  // Create UI for color map selection
  const presetSelector = document.createElement('select');
  presetSelector.setAttribute('class', selectorClass);
  presetSelector.innerHTML = vtkColorMaps.rgbPresetNames
    .map(
      (name) =>
        `<option value="${name}" ${lutName === name ? 'selected="selected"' : ''
        }>${name}</option>`
    )
    .join('');

  // Create UI for representation type
  const representationSelector = document.createElement('select');
  representationSelector.setAttribute('class', selectorClass);
  representationSelector.innerHTML = [
    'Hidden',
    'Points',
    'Wireframe',
    'Surface',
    'Surface with Edge',
  ]
    .map(
      (name, idx) =>
        `<option value="${idx === 0 ? 0 : 1}:${idx < 4 ? idx - 1 : 2}:${idx === 4 ? 1 : 0
        }">${name}</option>`
    )
    .join('');
  representationSelector.value = '1:2:0'

  // Creat UI for color by attribute
  const colorBySelector = document.createElement('select');
  colorBySelector.setAttribute('class', selectorClass);

  const componentSelector = document.createElement('select');
  componentSelector.setAttribute('class', selectorClass);
  componentSelector.style.display = 'none';

  // create UI for opacity selector
  const opacitySelector = document.createElement('input');
  opacitySelector.setAttribute('class', selectorClass);
  opacitySelector.setAttribute('type', 'range');
  opacitySelector.setAttribute('value', '100');
  opacitySelector.setAttribute('max', '100');
  opacitySelector.setAttribute('min', '1');

  // create UI for point size selector
  const pointSizeSelector = document.createElement('input');
  pointSizeSelector.setAttribute('class', selectorClass);
  pointSizeSelector.setAttribute('type', 'range');
  pointSizeSelector.setAttribute('value', '5');
  pointSizeSelector.setAttribute('max', '20');
  pointSizeSelector.setAttribute('min', '1');
  pointSizeSelector.style.display = ((representationSelector.value === '1:0:0') ? 'block' : 'none') // display for points

  // UI to show file name
  const labelSelector = document.createElement('label');
  labelSelector.setAttribute('class', selectorClass);
  labelSelector.innerHTML = fileName.replace(/\.[^/.]+$/, "");


  const labelOutlineSelector = document.createElement('label');
  labelOutlineSelector.setAttribute('class', selectorClass);
  labelOutlineSelector.setAttribute('htmlFor', 'OutlineCheckBox')
  labelOutlineSelector.innerHTML = "OutlineBox";

  const outlineSelector = document.createElement('input');
  outlineSelector.setAttribute('type', 'checkbox');
  outlineSelector.setAttribute('id', 'OutlineCheckBox');
  outlineSelector.setAttribute('name', 'OutlineCheckBox');
  outlineSelector.checked = false;

  var colorMapCanvas = document.createElement('canvas');
  colorMapCanvas.setAttribute('class', style.canvas);
  colorMapCanvas.setAttribute('id', 'cv');
  colorMapCanvas.height = 15;
  colorMapCanvas.width = 200;

  // Add controller to container
  const controlContainer = document.createElement('div');
  controlContainer.setAttribute('class', style.control);
  controlContainer.appendChild(labelSelector);
  controlContainer.appendChild(representationSelector);
  controlContainer.appendChild(presetSelector);
  controlContainer.appendChild(colorBySelector);
  controlContainer.appendChild(componentSelector);
  controlContainer.appendChild(opacitySelector);
  controlContainer.appendChild(outlineSelector);
  controlContainer.appendChild(labelOutlineSelector);
  controlContainer.appendChild(colorMapCanvas);
  controlContainer.appendChild(pointSizeSelector);
  rootControllerContainer.appendChild(controlContainer);


  // set up outline filter
  const outlineActor = vtkActor.newInstance({ 'scale': scaleArray, 'dragable': 1 });
  outlineActor.getProperty().setColor(...outlineColor)
  const outlineMapper = vtkMapper.newInstance();

  // Visualization Loader
  let ext = fileName.substr(fileName.lastIndexOf('.') + 1);
  let vtkEntity
  switch (ext) {
    case 'vtp':
      vtkEntity = vtkXMLPolyDataReader.newInstance();
      vtkEntity.parseAsArrayBuffer(fileContents);
      break;
    case 'stl':
      vtkEntity = vtkSTLReader.newInstance();
      vtkEntity.parseAsArrayBuffer(fileContents);
      break;
    case 'vti':
      vtkEntity = vtkXMLImageDataReader.newInstance()
      vtkEntity.parseAsArrayBuffer(fileContents);
      break;
  }

  const lookupTable = vtkColorTransferFunction.newInstance();
  const source = vtkEntity.getOutputData();

  let actor;
  let mapper;
  if (ext === 'vti') {
    actor = vtkVolume.newInstance({ 'scale': scaleArray, 'dragable': 1 });
    mapper = vtkVolumeMapper.newInstance({
      interpolateScalarsBeforeMapping: false,
      useLookupTableScalarRange: true,
      lookupTable,
      scalarVisibility: true
    });
  }
  else {
    // --- Set up the actor and mapper ---
    actor = vtkActor.newInstance({ 'scale': scaleArray, 'dragable': 1 });
    mapper = vtkMapper.newInstance({
      interpolateScalarsBeforeMapping: false,
      useLookupTableScalarRange: true,
      lookupTable,
      scalarVisibility: true
    });
  }

  actor.getProperty().setLineWidth(50);
  console.log(actor.getProperty().getLineWidth);
  // initialize the point size
  actor.getProperty().setPointSize(pointSizeSelector.value);

  const scalars = source.getPointData().getScalars();

  const dataRange = [].concat(scalars ? scalars.getRange() : [0, 1]);
  let activeArray = vtkDataArray;

  // --------------------------------------------------------------------
  // Color handling
  // --------------------------------------------------------------------
  function applyPreset() {
    const preset = vtkColorMaps.getPresetByName(presetSelector.value);
    lookupTable.applyColorMap(preset);
    lookupTable.setMappingRange(...dataRange);
    lookupTable.updateRange();
    if (colorBySelector.value === ':') {
      colorMapCanvas.style.display = 'none';
    }
    else {
      colorMapCanvas.style.display = 'block';
      updateColorCanvas(lookupTable, dataRange)
    }
  }
  applyPreset();
  presetSelector.addEventListener('change', applyPreset);

  // --------------------------------------------------------------------
  // Representation handling
  // --------------------------------------------------------------------
  function updateRepresentation(event) {
    const [
      visibility,
      representation,
      edgeVisibility,
    ] = event.target.value.split(':').map(Number);
    actor.getProperty().set({ representation, edgeVisibility });
    actor.setVisibility(!!visibility);

    if (representation === 0 && visibility === 1) {
      pointSizeSelector.style.display = 'block'
    }
    else {
      pointSizeSelector.style.display = 'none'
    }

    renderWindow.render();
  }
  representationSelector.addEventListener('change', updateRepresentation);

  // --------------------------------------------------------------------
  // Opacity handling
  // --------------------------------------------------------------------

  function updateOpacity(event) {
    const opacity = Number(event.target.value) / 100;
    actor.getProperty().setOpacity(opacity);
    renderWindow.render();
  }

  opacitySelector.addEventListener('input', updateOpacity);


  // --------------------------------------------------------------------
  // point size handling
  // --------------------------------------------------------------------
  function updatePointSize(event) {
    const pointSize = Number(event.target.value);
    actor.getProperty().setPointSize(pointSize);
    renderWindow.render();
  }

  pointSizeSelector.addEventListener('input', updatePointSize)
  // --------------------------------------------------------------------
  // outline box display option handling
  // -------------------------------------------------------------------
  function updateOutlineFilterDisplay(event) {
    if (event.target.checked) {
      renderer.addActor(outlineActor);
      renderWindow.render();
    }
    else {
      renderer.removeActor(outlineActor);
      renderWindow.render();
    }

  }
  outlineSelector.addEventListener('click', updateOutlineFilterDisplay);

  // --------------------------------------------------------------------
  // Color map canvas update
  // --------------------------------------------------------------------
  function updateColorCanvas(colorTransferFunction, rangeToUse, canvas) {
    const workCanvas = canvas || colorMapCanvas || document.createElement('canvas');

    let width;
    let height;

    if (workCanvas === canvas) {
      workCanvas.setAttribute('class', canvasClass);
    }

    let range1 = rangeToUse[0].toFixed(2).toString();
    let range2 = rangeToUse[1].toFixed(2).toString();

    const ctx = workCanvas.getContext('2d');
    ctx.clearRect(0, 0, workCanvas.width, workCanvas.height);
    ctx.font = '10px serif';

    let range1_width = Math.round(ctx.measureText(range1).width);
    let range2_width = Math.round(ctx.measureText(range2).width);

    width = 150;
    let offset = 14;
    workCanvas.width = width + (range1_width + range2_width) + offset;
    height = workCanvas.height;

    const rgba = colorTransferFunction.getUint8Table(
      rangeToUse[0],
      rangeToUse[1],
      width,
      4
    );
    const pixelsArea = ctx.getImageData(range1_width + (offset / 2 - 2), 0, width, height);
    for (let lineIdx = 0; lineIdx < height; lineIdx++) {
      pixelsArea.data.set(rgba, lineIdx * 4 * width);
    }

    const nbValues = height - 1 * width * 4;
    const lineSize = width * 4;
    for (let i = 3; i < nbValues; i += 4) {
      pixelsArea.data[i] = height - 1 - Math.floor(i / lineSize);
    }
    ctx.putImageData(pixelsArea, range1_width + 5, 0);


    ctx.textAlign = "left";
    ctx.fillText(range1, 0, workCanvas.height / 2);
    ctx.textAlign = "left";
    ctx.fillText(range2, range1_width + width + (offset / 2 + 2), workCanvas.height / 2);
    ctx.save();

  }

  // --------------------------------------------------------------------
  // ColorBy handling
  // --------------------------------------------------------------------
  const colorByOptions = [{ value: ':', label: 'Solid color' }].concat(
    source
      .getPointData()
      .getArrays()
      .map((a) => ({
        label: `(p) ${a.getName()}`,
        value: `PointData:${a.getName()}`,
      })),
    source
      .getCellData()
      .getArrays()
      .map((a) => ({
        label: `(c) ${a.getName()}`,
        value: `CellData:${a.getName()}`,
      }))
  );
  colorBySelector.innerHTML = colorByOptions
    .map(
      ({ label, value }) =>
        `<option value="${value}" ${field === value ? 'selected="selected"' : ''
        }>${label}</option>`
    )
    .join('');

  function updateColorBy(event) {
    const [location, colorByArrayName] = event.target.value.split(':');
    const interpolateScalarsBeforeMapping = location === 'PointData';
    let colorMode = ColorMode.DEFAULT;
    let scalarMode = ScalarMode.DEFAULT;
    const scalarVisibility = location.length > 0;
    if (scalarVisibility) {
      const newArray = source[`get${location}`]().getArrayByName(
        colorByArrayName
      );
      activeArray = newArray;
      const newDataRange = activeArray.getRange();
      dataRange[0] = newDataRange[0];
      dataRange[1] = newDataRange[1];
      colorMode = ColorMode.MAP_SCALARS;
      scalarMode =
        location === 'PointData'
          ? ScalarMode.USE_POINT_FIELD_DATA
          : ScalarMode.USE_CELL_FIELD_DATA;

      const numberOfComponents = activeArray.getNumberOfComponents();
      if (numberOfComponents > 1) {
        // always start on magnitude setting
        if (mapper.getLookupTable()) {
          const lut = mapper.getLookupTable();
          lut.setVectorModeToMagnitude();
        }
        componentSelector.style.display = 'block';
        const compOpts = ['Magnitude'];
        while (compOpts.length <= numberOfComponents) {
          compOpts.push(`Component ${compOpts.length}`);
        }
        componentSelector.innerHTML = compOpts
          .map((t, index) => `<option value="${index - 1}">${t}</option>`)
          .join('');
      } else {
        componentSelector.style.display = 'none';
      }
    } else {
      componentSelector.style.display = 'none';
    }
    mapper.set({
      colorByArrayName,
      colorMode,
      interpolateScalarsBeforeMapping,
      scalarMode,
      scalarVisibility,
    });
    applyPreset();
  }
  colorBySelector.addEventListener('change', updateColorBy);
  updateColorBy({ target: colorBySelector });

  function updateColorByComponent(event) {
    if (mapper.getLookupTable()) {
      const lut = mapper.getLookupTable();
      if (event.target.value === -1) {
        lut.setVectorModeToMagnitude();
      } else {
        lut.setVectorModeToComponent();
        lut.setVectorComponent(Number(event.target.value));
        const newDataRange = activeArray.getRange(Number(event.target.value));
        dataRange[0] = newDataRange[0];
        dataRange[1] = newDataRange[1];
        lookupTable.setMappingRange(dataRange[0], dataRange[1]);
        lut.updateRange();
      }
      renderWindow.render();
    }
  }
  componentSelector.addEventListener('change', updateColorByComponent);


  // --- set up our filter
  const filter = vtkOutlineFilter.newInstance();

  // coneSource -> filter
  filter.setInputConnection(vtkEntity.getOutputPort());

  // mapper to the object it self
  mapper.setInputConnection(vtkEntity.getOutputPort());
  // filter -> mapper
  outlineMapper.setInputConnection(filter.getOutputPort());

  // tell the actor which mapper to use
  actor.setMapper(mapper);
  outlineActor.setMapper(outlineMapper);

  if (ext === 'vti') {
    renderer.addVolume(actor);
  }
  else {
    renderer.addActor(actor);
  }

  // Manage update when lookupTable change
  lookupTable.onModified(() => {
    renderWindow.render();
  });

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
    createPipeline(file.name, reader.result);
  };
  reader.readAsArrayBuffer(file);
}

// ----------------------------------------------------------------------------

export function load(container, options) {
  autoInit = false;
  emptyContainer(container);

  if (options.files) {
    createViewer(container);
    let count = options.files.length;

    let sortedFiles = [];
    while (count--) {
      sortedFiles.push(options.files[count])
    }
    sortedFiles.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));

    for (var i = 0; i < sortedFiles.length; i++) {
      loadFile(sortedFiles[i]);
    }

    updateCamera(renderer.getActiveCamera());
  } else if (options.fileURL) {
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
  fileContainer.innerHTML = `<div class="${style.bigFileDrop}"/><input type="file" multiple accept=".vtp,.stl,.vtk,.vti" style="display: none;"/>`;
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
