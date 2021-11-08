import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124.0/build/three.module.js'
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.124.0/examples/jsm/controls/OrbitControls.js'
import rhino3dm from 'https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/rhino3dm.module.js'
import { Rhino3dmLoader } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/loaders/3DMLoader.js'
import { TransformControls } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/controls/TransformControls.js'

/* eslint no-undef: "off", no-unused-vars: "off" */

const definition = 'NOW_AI_test1.gh'

// setup input change events
const UsmeBdy = document.getElementById( 'RH_IN:usmeBdy' )
UsmeBdy.addEventListener( 'change', onSliderChange, false )

const E_risk1= document.getElementById( 'RH_IN:E_risk1' )
E_risk1.addEventListener( 'change', onSliderChange, false )

const E_risk2= document.getElementById( 'RH_IN:E_risk2' )
E_risk2.addEventListener( 'change', onSliderChange, false )

const E_risk3= document.getElementById( 'RH_IN:E_risk3' )
E_risk3.addEventListener( 'change', onSliderChange, true )

const E_risk4= document.getElementById( 'RH_IN:E_risk4' )
E_risk4.addEventListener( 'change', onSliderChange, true )

const E_risk5= document.getElementById( 'RH_IN:E_risk5' )
E_risk5.addEventListener( 'change', onSliderChange, true )

const resi_percentage_slider = document.getElementById( 'resi_percentage' )
resi_percentage_slider.addEventListener( 'mouseup', onSliderChange, false )
resi_percentage_slider.addEventListener( 'touchend', onSliderChange, false )

const resi_size_slider = document.getElementById( 'resi_size' )
resi_size_slider.addEventListener( 'mouseup', onSliderChange, false )
resi_size_slider.addEventListener( 'touchend', onSliderChange, false )

const employment_slider = document.getElementById( 'employment' )
employment_slider.addEventListener( 'mouseup', onSliderChange, false )
employment_slider.addEventListener( 'touchend', onSliderChange, false )

const commercial_size_slider = document.getElementById( 'commercial_size' )
commercial_size_slider.addEventListener( 'mouseup', onSliderChange, false )
commercial_size_slider.addEventListener( 'touchend', onSliderChange, false )

const P_risk1= document.getElementById( 'RH_IN:P_risk1' )
P_risk1.addEventListener( 'change', onSliderChange, false )

const P_risk2= document.getElementById( 'RH_IN:P_risk2' )
P_risk2.addEventListener( 'change', onSliderChange, false )

const P_risk3= document.getElementById( 'RH_IN:P_risk3' )
P_risk3.addEventListener( 'change', onSliderChange, false )

const P_risk4= document.getElementById( 'RH_IN:P_risk4' )
P_risk4.addEventListener( 'change', onSliderChange, false )


// load the rhino3dm library
let rhino
rhino3dm().then(async m => {
  console.log('Loaded rhino3dm.')
  rhino = m // global

  init()
  compute()
})



let _threeMesh, _threeMaterial

/**
 * Call appserver
 */
async function compute(){
  let t0 = performance.now()
  const timeComputeStart = t0

  // collect data from inputs
  let data = {}
  data.definition = definition  
  data.inputs = {
   'RH_IN:usmeBdy': UsmeBdy.checked,
   'RH_IN:E_risk1': E_risk1.checked,
   'RH_IN:E_risk2': E_risk2.checked,
   'RH_IN:E_risk3': E_risk3.checked,
   'RH_IN:E_risk4': E_risk4.checked,
   'RH_IN:E_risk5': E_risk5.checked,

   'resi_percentage': resi_percentage_slider.valueAsNumber,
   'resi_size': resi_size_slider.valueAsNumber,
   'employment': employment_slider.valueAsNumber,
   'commercial_size': commercial_size_slider.valueAsNumber,

   'RH_IN:P_risk1': P_risk1.checked,
   'RH_IN:P_risk2': P_risk2.checked,
   'RH_IN:P_risk3': P_risk3.checked,
   'RH_IN:P_risk4': P_risk4.checked,

  }

  console.log(data.inputs)

  const request = {
    'method':'POST',
    'body': JSON.stringify(data),
    'headers': {'Content-Type': 'application/json'}
  }

  let headers = null

  try {
    const response = await fetch('/solve', request)

    if(!response.ok)
      throw new Error(response.statusText)
      
    headers = response.headers.get('server-timing')
    const responseJson = await response.json()

    // Request finished. Do processing here.
    let t1 = performance.now()
    const computeSolveTime = t1 - timeComputeStart
    t0 = t1

    // hide spinner
    document.getElementById('loader').style.display = 'none'
    let data = JSON.parse(responseJson.values[0].InnerTree['{ 0; }'][0].data)
    let mesh = rhino.DracoCompression.decompressBase64String(data)
      
    t1 = performance.now()
    const decodeMeshTime = t1 - t0
    t0 = t1

    if (!_threeMaterial) {
      _threeMaterial = new THREE.MeshNormalMaterial()
    }
    let threeMesh = meshToThreejs(mesh, _threeMaterial)
    mesh.delete()
    replaceCurrentMesh(threeMesh)

    t1 = performance.now()
    const rebuildSceneTime = t1 - t0

    console.group(`[call compute and rebuild scene] = ${Math.round(t1-timeComputeStart)} ms`)
    //console.log(`[call compute and rebuild scene] = ${Math.round(t1-timeComputeStart)} ms`)
    console.log(`  ${Math.round(computeSolveTime)} ms: appserver request`)
    let timings = headers.split(',')
    let sum = 0
    timings.forEach(element => {
      let name = element.split(';')[0].trim()
      let time = element.split('=')[1].trim()
      sum += Number(time)
      if (name === 'network') {
        console.log(`  .. ${time} ms: appserver<->compute network latency`)
      } else {
        console.log(`  .. ${time} ms: ${name}`)
      }
    })
    console.log(`  .. ${Math.round(computeSolveTime - sum)} ms: local<->appserver network latency`)
    console.log(`  ${Math.round(decodeMeshTime)} ms: decode json to rhino3dm mesh`)
    console.log(`  ${Math.round(rebuildSceneTime)} ms: create threejs mesh and insert in scene`)
    console.groupEnd()

  } catch(error) {
    console.error(error)
  }
  
}

/**
 * Called when a slider value changes in the UI. Collect all of the
 * slider values and call compute to solve for a new scene
 */
function onSliderChange () {
  // show spinner
  document.getElementById('loader').style.display = 'block'
  compute()
}

// BOILERPLATE //

var scene, camera, renderer, controls

function init () {
  // Rhino models are z-up, so set this as the default
  THREE.Object3D.DefaultUp = new THREE.Vector3( 0, 0, 1 );

  scene = new THREE.Scene()
  scene.background = new THREE.Color(1,1,1)
  camera = new THREE.PerspectiveCamera( 45, window.innerWidth/window.innerHeight, 1, 1000 )

  renderer = new THREE.WebGLRenderer({antialias: true})
  renderer.setPixelRatio( window.devicePixelRatio )
  renderer.setSize( window.innerWidth, window.innerHeight )
  document.body.appendChild(renderer.domElement)

  controls = new OrbitControls( camera, renderer.domElement  )

  camera.position.z = 50

  window.addEventListener( 'resize', onWindowResize, false )

  animate()
}

var animate = function () {
  requestAnimationFrame( animate )
  controls.update()
  renderer.render( scene, camera )
}
  
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize( window.innerWidth, window.innerHeight )
  animate()
}

function replaceCurrentMesh (threeMesh) {
  if (_threeMesh) {
    scene.remove(_threeMesh)
    _threeMesh.geometry.dispose()
  }
  _threeMesh = threeMesh
  scene.add(_threeMesh)
}

function meshToThreejs (mesh, material) {
  let loader = new THREE.BufferGeometryLoader()
  var geometry = loader.parse(mesh.toThreejsJSON())
  return new THREE.Mesh(geometry, material)
}
