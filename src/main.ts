import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { RGBELoader } from 'three/examples/jsm/Addons.js';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import gsap from 'gsap';

// 创建渲染器
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // 像素比

document.body.appendChild(renderer.domElement);

// 创建场景
const scene = new THREE.Scene();

/**  实现动态反射环境 **/ 
// 1 创建WebGLCubeRenderTarget
const cubeRendererTarget = new THREE.WebGLCubeRenderTarget(1024);
// 2 将cubeRendererTarget对象作为参数传递给cubeCamera
const cubeCamera = new THREE.CubeCamera(0.1, 500, cubeRendererTarget);
// 3 在帧循环中调用 cubeCamera.update ，每帧更新渲染结果
// 4 cubeRendererTarget对象的texture环境材质的环境贴图通道：envMap
let ground: any;

// const boxGeo = new THREE.BoxGeometry(1, 1, 1);
// const boxMat = new THREE.MeshBasicMaterial({color: 0x00ff00});
// const boxMesh = new THREE.Mesh(boxGeo, boxMat);
// scene.add(boxMesh);
// boxMesh.position.set(0, 3.2, 0);

// 创建相机
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 500);
camera.position.set(0, 1, 5);

const controls = new OrbitControls(camera, renderer.domElement);

const gltfLoader = new GLTFLoader();
gltfLoader.load('car.glb', (gltf) => {
    scene.add(gltf.scene);

    gltf.scene.traverse((child: any) => {
        if (child.type == "Mesh") {
            child.material.envMap = cubeRendererTarget.texture;
            // child.visible = false;
        }
        if (child.name == "ground") {
            // child.material.side = THREE.DoubleSide;
            // child.visible = true;
            ground = child;
        }
        if (child.name == "flyLight") {
            // 使隧道远处的飞行粒子清晰
            child.material.map.anisotropy = 8;

            gsap.to(child.material.map.offset, {
                x: -1,
                repeat: -1,
                ease: 'none',
                duration: 0.5
            })
        }
        if (child.name == "mainCar") {
            // 使车身变亮
            child.traverse((item: any) => {
                if (item.type == "Mesh") {
                    item.material.envMapIntensity = 5;
                }
            })
        }
    })
})

const rgbeLoader = new RGBELoader();
rgbeLoader.load('sky.hdr', skyTexture => {
    scene.background = skyTexture;
    scene.environment = skyTexture;
    skyTexture.mapping = THREE.EquirectangularReflectionMapping; // 全景图
})

renderer.setAnimationLoop(animationLoop);

function animationLoop() {
    controls.update();
    
    if (ground) {
        ground.visible = false;
        cubeCamera.position.copy(camera.position);
        cubeCamera.position.y = -cubeCamera.position.y;
        cubeCamera.update(renderer, scene);
        ground.visible = true;
    }

    renderer.render(scene, camera);
}
