import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkOutlineFilter from 'vtk.js/Sources/Filters/General/OutlineFilter'
import vtkConeSource from 'vtk.js/Sources/Filters/Sources/ConeSource';


// --- Set up our renderer ---

const container = document.querySelector('#container');

// We use the wrapper here to abstract out manual RenderWindow/Renderer/OpenGLRenderWindow setup
const genericRenderWindow = vtkGenericRenderWindow.newInstance();
genericRenderWindow.setContainer(container);
genericRenderWindow.resize();

const renderer = genericRenderWindow.getRenderer();
const renderWindow = genericRenderWindow.getRenderWindow();


// --- Set up the cone actor --- Note that the mapper provides mapping from the actor to
// a visualization object
const actor = vtkActor.newInstance();
const mapper = vtkMapper.newInstance();

// Set up the outline filter actor
const outlineActor = vtkActor.newInstance();
const outlineMapper = vtkMapper.newInstance();


// this generates a cone
const coneSource = vtkConeSource.newInstance({
  height: 1.0,
  resolution: 50,
});

// This generates an outline filter tool that will process the visualization source i.e.
// the cone
// Note that using InputConnection and OutputPort is a reactive way to passing an object
// to a filter or make connection between entities
const outlineFilterSource = vtkOutlineFilter.newInstance();
outlineFilterSource.setInputConnection(coneSource.getOutputPort());


// the mapper reads in the cone polydata
// this sets up a pipeline: coneSource -> mapper
mapper.setInputConnection(coneSource.getOutputPort());
outlineMapper.setInputConnection(outlineFilterSource.getOutputPort())

// tell the actor which mapper to use
actor.setMapper(mapper);
outlineActor.setMapper(outlineMapper);


// --- Add actor to scene ---

renderer.addActor(actor);
renderer.addActor(outlineActor);


// --- Reset camera and render the scene ---

renderer.resetCamera();
renderWindow.render();


// --- Expose globals so we can play with values in the dev console ---

global.renderWindow = renderWindow;
global.renderer = renderer;
global.coneSource = coneSource;
global.actor = actor;
global.mapper = mapper;
