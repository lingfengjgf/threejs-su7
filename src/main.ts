import * as THREE from 'three';
import { GLTFLoader, RGBELoader, OrbitControls, EffectComposer, RenderPass, UnrealBloomPass } from 'three/examples/jsm/Addons.js';

import gsap from 'gsap';

// 创建渲染器
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // 像素比

document.body.appendChild(renderer.domElement);

// 创建场景
const scene = new THREE.Scene();
// 雾
scene.fog = new THREE.FogExp2(0x000000, 0.005);

/**  实现动态反射环境 **/ 
// 1 创建WebGLCubeRenderTarget
const cubeRendererTarget = new THREE.WebGLCubeRenderTarget(1024);
// 2 将cubeRendererTarget对象作为参数传递给cubeCamera
const cubeCamera = new THREE.CubeCamera(0.1, 600, cubeRendererTarget);
// 3 在帧循环中调用 cubeCamera.update ，每帧更新渲染结果
// 4 cubeRendererTarget对象的texture环境材质的环境贴图通道：envMap
let ground: any;
let ground_func4: any;

let curFuncIndex = 0;

// const boxGeo = new THREE.BoxGeometry(1, 1, 1);
// const boxMat = new THREE.MeshBasicMaterial({color: 0x00ff00});
// const boxMesh = new THREE.Mesh(boxGeo, boxMat);
// scene.add(boxMesh);
// boxMesh.position.set(0, 3.2, 0);

// 创建相机
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 600);
camera.position.set(0, 1.5, 8);

const controls = new OrbitControls(camera, renderer.domElement);

// 设置镜头转动最大最小角度
controls.maxPolarAngle = 1.4;
controls.minPolarAngle = 0.1;

// 设置镜头移动动最大最小距离
controls.maxDistance = 8;
controls.minDistance = 6;

// 保存场景模型
const nameToMeshDic: any = { camera };

let clipPlane01: THREE.Plane, clipPlane02: THREE.Plane, clipSpeed = 0.6;

let radarVertexArray: THREE.Vector3[] = [];
let radarMeshArray: THREE.Mesh[] = [];
const ver3RadarLookAtTarget = new THREE.Vector3(0, 1.2, 0);
let radarGroup = new THREE.Group();
let isLeftMouseDown: Boolean;

const gltfLoader = new GLTFLoader();
gltfLoader.load('car.glb', (gltf) => {
    scene.add(gltf.scene);

    gltf.scene.traverse((child: any) => {

        nameToMeshDic[child.name] = child;

        if (child.type == "Mesh") {
            child.material.envMap = cubeRendererTarget.texture;
            // child.visible = false;
        }
        if (child.name == "ground") {
            // child.material.side = THREE.DoubleSide;
            // child.visible = true;
            ground = child;
        }
        if (child.name == "mainCar") {
            // 使车身变亮
            child.traverse((item: any) => {
                if (item.type == "Mesh") {
                    item.material.envMapIntensity = 5;
                }
            })
        }
        if (child.name == "flyLight") {
            // 使隧道远处的飞行粒子清晰
            child.material.map.anisotropy = 8;
            // 初始状态隧道透明，按下鼠标左键展示隧道粒子
            child.material.opacity = 0;
        }
        if (child.name == "whiteLine") {
            child.visible = false;
            const whiteLine = child;
            const whiteLineTween = gsap.to(whiteLine.material.map.offset, {
                y: whiteLine.material.map.offset.y + 1,
                repeat: -1,
                ease: 'none',
                duration: 40
            })
            whiteLine.userData['tween'] = whiteLineTween;
        }
        // 车身标注
        if (child.name == "widthHeightDepth") {
            child.visible = false;
        }
        // 风阻
        if (child.name == "windage") {
            child.visible = false;
        }
        // 车身边线
        if (child.name == "outLine") {
            child.visible = false;
        }

        if (child.name == 'mainCarClip') {
            clipPlane01 = new THREE.Plane(new THREE.Vector3(1, 0, 0), -4);
            clipPlane02 = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 4.05);

            // const clipPlane01Helper = new THREE.PlaneHelper(clipPlane01, 6, 0xff0000);
            // scene.add(clipPlane01Helper);
            // const clipPlane02Helper = new THREE.PlaneHelper(clipPlane02, 6, 0x00ff00);
            // scene.add(clipPlane02Helper);

            const clipMaterial = new THREE.MeshBasicMaterial({
                side: THREE.DoubleSide,
                clippingPlanes: [clipPlane01, clipPlane02]
            });

            child.material = clipMaterial;

            renderer.localClippingEnabled = true;
        }

        // 雷达
        if (child.name == "radar") {
            const positionAttribute = child.geometry.getAttribute('position');

            for (let i = 0; i < positionAttribute.count; i++) {
                const ver3 = new THREE.Vector3();
                ver3.fromBufferAttribute(positionAttribute, i);
                radarVertexArray.push(ver3);
            }
        }
        // 雷达路面
        if (child.name == "ground_func4") {
            child.visible = false;
            ground_func4 = child;
        }
    })
})

const rgbeLoader = new RGBELoader();
rgbeLoader.load('sky.hdr', skyTexture => {
    scene.background = skyTexture;
    scene.environment = skyTexture;
    skyTexture.mapping = THREE.EquirectangularReflectionMapping; // 全景图
})

let effectComposer: EffectComposer;
function initEffects() {
    effectComposer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const unrealPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.1, 0.1);

    effectComposer.addPass(renderPass);
    effectComposer.addPass(unrealPass);
}
initEffects();

window.addEventListener('mousedown', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLCanvasElement)) {
        return ;
    }
    if (e.button == 0) {
        isLeftMouseDown = true;
    }
    if (curFuncIndex === 0) {
        if (e.button == 0) {
            const cameraFovTween = gsap.to(camera, {
                fov: 80,
                repeat: 0,
                ease: 'power1.inOut',
                duration: 0.3,
                onUpdate: () => {
                    camera.updateProjectionMatrix();
                },
                onComplete: () => {
                    cameraFovTween.kill();
                }
            })
    
            // 隧道粒子
            const flyLight = nameToMeshDic['flyLight'];
            const flyLightTween = gsap.to(flyLight.material.map.offset, {
                x: flyLight.material.map.offset.x - 1,
                repeat: -1,
                ease: 'none',
                duration: 0.5
            })
            flyLight.userData['tween'] = flyLightTween;
    
            // 隧道粒子渐显
            const opacityTween = gsap.to(flyLight.material, {
                opacity: 1,
                repeat: 0,
                ease: 'none',
                duration: 0.5
            })
            flyLight.userData['opacityTween'] = opacityTween;
    
            // 前车轮滚动
            const wheelFront = nameToMeshDic['wheelFront'];
            const wheelFrontStartTween = gsap.to(wheelFront.rotation, {
                y: wheelFront.rotation.y + 4 * Math.PI,
                repeat: 0,
                duration: 1,
                ease: 'power1.in',
                onComplete: () => {
                    const wheelFrontTween = gsap.to(wheelFront.rotation, {
                        y: wheelFront.rotation.y + 2 * Math.PI,
                        repeat: -1,
                        ease: 'none',
                        duration: 0.3
                    })
                    wheelFront.userData['tween'] = wheelFrontTween;
    
                    // 车身抖动效果
                    const shakeXTween = gsap.to(camera.position, {
                        x: camera.position.x + 0.01,
                        repeat: -1,
                        ease: 'power1.inOut',
                        duration: 0.1
                    })
                    nameToMeshDic['camera'].userData['shakeXTween'] = shakeXTween;
                    const shakeYTween = gsap.to(camera.position, {
                        y: camera.position.y + 0.01,
                        repeat: -1,
                        ease: 'power1.inOut',
                        duration: 0.15
                    })
                    nameToMeshDic['camera'].userData['shakeYTween'] = shakeYTween;
                }
            })
            wheelFront.userData['startTween'] = wheelFrontStartTween;
    
            // 后车轮滚动
            const wheelBack = nameToMeshDic['wheelBack'];
            const wheelBackStartTween = gsap.to(wheelBack.rotation, {
                y: wheelFront.rotation.y + 4 * Math.PI,
                repeat: 0,
                duration: 1,
                ease: 'power1.in',
                onComplete: () => {
                    const wheelBackTween = gsap.to(wheelBack.rotation, {
                        y: wheelFront.rotation.y + 2 * Math.PI,
                        repeat: -1,
                        ease: 'none',
                        duration: 0.3
                    })
                    wheelBack.userData['tween'] = wheelBackTween;
                }
            })
            wheelBack.userData['startTween'] = wheelBackStartTween;
    
            // 车身阴影 路面
            const groundDetail = nameToMeshDic['groundDetail'];
            const groundDetailStartTween = gsap.to(groundDetail.material.map.offset, {
                x: groundDetail.material.map.offset.x - 1,
                repeat: 0,
                ease: 'power1.in',
                duration: 1,
                onComplete: () => {
                    const groundDetailTween = gsap.to(groundDetail.material.map.offset, {
                        x: groundDetail.material.map.offset.x - 10,
                        repeat: -1,
                        ease: 'none',
                        duration: 10
                    })
                    groundDetail.userData['tween'] = groundDetailTween;
                }
            })
            groundDetail.userData['startTween'] = groundDetailStartTween;
        }
    }

    if (curFuncIndex === 1) {
        nameToMeshDic['widthHeightDepth'].visible = true;
        
        const whiteLine = nameToMeshDic['whiteLine'];
        whiteLine.material.opacity = 0;
        whiteLine.visible = true;
        if (whiteLine.userData['opacityTween']) {
            whiteLine.userData['opacityTween'].kill();
        }
        const whiteLineOpacityTween = gsap.to(whiteLine.material, {
            opacity: 1,
            repeat: 0,
            duration: 2,
            ease: 'none'
        })
        whiteLine.userData['opacityTween'] = whiteLineOpacityTween;
        const cameraFovTween = gsap.to(camera, {
            fov: 80,
            repeat: 0,
            ease: 'power1.inOut',
            duration: 0.3,
            onUpdate: () => {
                camera.updateProjectionMatrix();
            },
            onComplete: () => {
                cameraFovTween.kill();
            }
        })
    }

    if (curFuncIndex === 2) {
        const cameraFovTween = gsap.to(camera, {
            fov: 80,
            repeat: 0,
            ease: 'power1.inOut',
            duration: 0.3,
            onUpdate: () => {
                camera.updateProjectionMatrix();
            },
            onComplete: () => {
                cameraFovTween.kill();
            }
        })
        const outLine = nameToMeshDic['outLine'];
        outLine.visible = true;
        const outLineTween = gsap.to(outLine.material.map.offset, {
            x: outLine.material.map.offset.x + 1,
            repeat: -1,
            duration: 0.25,
            ease: 'none',
            onStart: () => {
                // nameToMeshDic['mainCar'].visible = false;
                nameToMeshDic['mainCarBody'].visible = false;
                nameToMeshDic['wheelFront'].visible = false;
                nameToMeshDic['wheelBack'].visible = false;
            }
        })
        outLine.userData['tween'] = outLineTween;

        const killTweens = ['mainCarShell', 'mainCarClip'];
        killTweens.forEach(name => {
            Object.keys(nameToMeshDic[name].userData).forEach(key => {
                if (key.indexOf('ween') > 0) {
                    nameToMeshDic[name].userData[key].kill();
                }
            })
        })

        // 车壳裁剪
        const mainCarShell = nameToMeshDic['mainCarShell'];
        const mainCarShellTween = gsap.to(mainCarShell.material, {
            alphaTest: 1,
            duration: clipSpeed,
            repeat: 0,
            ease: 'none'
        })
        mainCarShell.userData['tween'] = mainCarShellTween;

        clipPlane01.constant = -4;
        const clipPlane01Tween = gsap.to(clipPlane01, {
            constant: 3.6,
            duration: clipSpeed,
            repeat: 0,
            ease: 'none',
            onComplete: () => {
                nameToMeshDic['windage'].visible = false;
                nameToMeshDic['mainCarBody'].visible = false;
            }
        })
        nameToMeshDic['mainCarClip'].userData['clipPlane01Tween'] = clipPlane01Tween;

        clipPlane02.constant = 4.05;
        const clipPlane02Tween = gsap.to(clipPlane02, {
            constant: -3.55,
            duration: clipSpeed,
            repeat: 0,
            ease: 'none'
        })
        nameToMeshDic['mainCarClip'].userData['clipPlane02Tween'] = clipPlane02Tween;
    }

    if (curFuncIndex === 3) {
        radarGroup.visible = true;
        const cameraFovTween = gsap.to(camera, {
            fov: 80,
            repeat: 0,
            ease: 'power1.inOut',
            duration: 0.3,
            onUpdate: () => {
                camera.updateProjectionMatrix();
            },
            onComplete: () => {
                cameraFovTween.kill();
            }
        })
        if (!radarMeshArray.length) {
            const boxGeo = new THREE.BoxGeometry(0.05, 0.05, 0.2);
            scene.add(radarGroup);
            radarGroup.position.set(0, 1, 0);
            for (let i = 0; i < 6; i++) {
                for (let radarVertex of radarVertexArray) {
                    const boxMat = new THREE.MeshBasicMaterial({color: 0x00ff00});
                    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
                    boxMesh.position.copy(radarVertex);
                    boxMesh.visible = false;
                    radarGroup.add(boxMesh);
                    // scene.add(boxMesh);
                    radarMeshArray.push(boxMesh);
                    boxMesh.lookAt(ver3RadarLookAtTarget);
    
                    // boxMesh.userData['originPos'] = boxMesh.position.clone(); // 车身雷达起始位置
                    boxMesh.translateZ(-6);
                    boxMesh.userData['targetPos'] = boxMesh.position.clone(); // 车身雷达终点位置
                    boxMesh.translateZ(6);

                    boxMesh.userData['delay'] = i < 3 ? i / 2 : (i + 1) / 2;
                }
    
                for (const radarMesh of radarMeshArray) {
                    gsap.to(radarMesh.position, {
                        x: radarMesh.userData['targetPos'].x,
                        y: radarMesh.userData['targetPos'].y,
                        z: radarMesh.userData['targetPos'].z,
                        duration: 2,
                        repeat: -1,
                        ease: 'none',
                        delay: radarMesh.userData['delay'],
                        onStart: () => {
                            radarMesh.userData['isTweening'] = true;
                            radarMesh.visible = true;
                        }
                    })
                }

            }
        }

        nameToMeshDic['groundDetail'].visible = false;
        nameToMeshDic['rectAreaLight'].visible = false;
        
        const ground_func4 = nameToMeshDic['ground_func4'];
        ground_func4.visible = true;
        const groundFunc4Tween = gsap.to(ground_func4.material.map.offset, {
            x: ground_func4.material.map.offset.x - 1,
            repeat: -1,
            duration: 1.2,
            ease: 'none'
        })
        ground_func4.userData['tween'] = groundFunc4Tween;

        // 前车轮滚动
        const wheelFront = nameToMeshDic['wheelFront'];
        const wheelFrontStartTween = gsap.to(wheelFront.rotation, {
            y: wheelFront.rotation.y + 4 * Math.PI,
            repeat: 0,
            duration: 1,
            ease: 'power1.in',
            onComplete: () => {
                const wheelFrontTween = gsap.to(wheelFront.rotation, {
                    y: wheelFront.rotation.y + 2 * Math.PI,
                    repeat: -1,
                    ease: 'none',
                    duration: 0.3
                })
                wheelFront.userData['tween'] = wheelFrontTween;
            }
        })
        wheelFront.userData['startTween'] = wheelFrontStartTween;

        // 后车轮滚动
        const wheelBack = nameToMeshDic['wheelBack'];
        const wheelBackStartTween = gsap.to(wheelBack.rotation, {
            y: wheelFront.rotation.y + 4 * Math.PI,
            repeat: 0,
            duration: 1,
            ease: 'power1.in',
            onComplete: () => {
                const wheelBackTween = gsap.to(wheelBack.rotation, {
                    y: wheelFront.rotation.y + 2 * Math.PI,
                    repeat: -1,
                    ease: 'none',
                    duration: 0.3
                })
                wheelBack.userData['tween'] = wheelBackTween;
            }
        })
        wheelBack.userData['startTween'] = wheelBackStartTween;
    }
})

window.addEventListener('mouseup', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLCanvasElement)) {
        return ;
    }
    if (e.button == 0) {
        isLeftMouseDown = false;
    }
    if (curFuncIndex === 0) {
        if (e.button == 0) {
            const cameraFovTween = gsap.to(camera, {
                fov: 60,
                repeat: 0,
                ease: 'power1.inOut',
                duration: 0.3,
                onUpdate: () => {
                    camera.updateProjectionMatrix();
                },
                onComplete: () => {
                    cameraFovTween.kill();
                }
            })
    
            // 停止动效
            const killTweens = ['flyLight', 'wheelFront', 'wheelBack', 'groundDetail', 'camera'];
            killTweens.forEach(name => {
                Object.keys(nameToMeshDic[name].userData).forEach(key => {
                    if (key.indexOf('ween') > 0) {
                        nameToMeshDic[name].userData[key].kill();
                    }
                })
            })
            // nameToMeshDic['flyLight'].userData['tween'].kill();
            // nameToMeshDic['flyLight'].userData['opacityTween'].kill();
            // nameToMeshDic['wheelFront'].userData['tween'].kill();
            // nameToMeshDic['wheelFront'].userData['startTween'].kill();
            // nameToMeshDic['wheelBack'].userData['tween'].kill();
            // nameToMeshDic['wheelBack'].userData['startTween'].kill();
            // nameToMeshDic['groundDetail'].userData['tween'].kill();
            // nameToMeshDic['groundDetail'].userData['startTween'].kill();
    
            const flyLight = nameToMeshDic['flyLight'];
            const opacityTween = gsap.to(flyLight.material, {
                opacity: 0,
                repeat: 0,
                ease: 'none',
                duration: 0.5,
                onComplete: () => {
                    opacityTween.kill();
                }
            });
            
            const wheelFront = nameToMeshDic['wheelFront'];
            const wheelFrontEndTween = gsap.to(wheelFront.rotation, {
                y: wheelFront.rotation.y + 2 * Math.PI,
                repeat: 0,
                duration: 0.3,
                ease: 'power1.out',
                onComplete: () => {
                    wheelFrontEndTween.kill();
                }
            });
    
            const wheelBack = nameToMeshDic['wheelBack'];
            const wheelBackEndTween = gsap.to(wheelBack.rotation, {
                y: wheelFront.rotation.y + 2 * Math.PI,
                repeat: 0,
                duration: 0.3,
                ease: 'power1.in',
                onComplete: () => {
                    wheelBackEndTween.kill();
                }
            })
    
            const groundDetail = nameToMeshDic['groundDetail'];
            const groundDetailEndTween = gsap.to(groundDetail.material.map.offset, {
                x: groundDetail.material.map.offset.x - 1,
                repeat: 0,
                ease: 'power1.out',
                duration: 0.3,
                onComplete: () => {
                    groundDetailEndTween.kill();
                }
            })
        }
    }
    if (curFuncIndex === 1) {
        // nameToMeshDic['whiteLine'].visible = false;
        // nameToMeshDic['widthHeightDepth'].visible = false;

        const whiteLine = nameToMeshDic['whiteLine'];
        if (whiteLine.userData['opacityTween']) {
            whiteLine.userData['opacityTween'].kill();
        }
        const whiteLineOpacityTween = gsap.to(whiteLine.material, {
            opacity: 0,
            repeat: 0,
            duration: 1,
            ease: 'none',
            onComplete: () => {
                nameToMeshDic['whiteLine'].visible = false;
                whiteLineOpacityTween.kill();
            }
        })
        const cameraFovTween = gsap.to(camera, {
            fov: 60,
            repeat: 0,
            ease: 'power1.inOut',
            duration: 0.3,
            onUpdate: () => {
                camera.updateProjectionMatrix();
            },
            onComplete: () => {
                cameraFovTween.kill();
            }
        })
    }

    if (curFuncIndex === 2) {
        const killTweens = ['outLine', 'mainCarShell', 'mainCarClip'];
        killTweens.forEach(name => {
            Object.keys(nameToMeshDic[name].userData).forEach(key => {
                if (key.indexOf('ween') > 0) {
                    nameToMeshDic[name].userData[key].kill();
                }
            })
        })

        const outLine = nameToMeshDic['outLine'];
        outLine.visible = false;
        const cameraFovTween = gsap.to(camera, {
            fov: 60,
            repeat: 0,
            ease: 'power1.inOut',
            duration: 0.3,
            onUpdate: () => {
                camera.updateProjectionMatrix();
            },
            onComplete: () => {
                cameraFovTween.kill();
            },
        })

        const mainCarShell = nameToMeshDic['mainCarShell'];
        const mainCarShellTween = gsap.to(mainCarShell.material, {
            alphaTest: 0,
            duration: clipSpeed,
            repeat: 0,
            ease: 'none'
        })
        mainCarShell.userData['tween'] = mainCarShellTween;

        const clipPlane01Tween = gsap.to(clipPlane01, {
            constant: -4,
            duration: clipSpeed,
            repeat: 0,
            ease: 'none',
            onComplete: () => {
                nameToMeshDic['windage'].visible = true;
                nameToMeshDic['mainCarBody'].visible = true;
                nameToMeshDic['wheelFront'].visible = true;
                nameToMeshDic['wheelBack'].visible = true;
            }
        })
        nameToMeshDic['mainCarClip'].userData['clipPlane01Tween'] = clipPlane01Tween;

        const clipPlane02Tween = gsap.to(clipPlane02, {
            constant: 4.05,
            duration: clipSpeed,
            repeat: 0,
            ease: 'none'
        })
        nameToMeshDic['mainCarClip'].userData['clipPlane02Tween'] = clipPlane02Tween;
    }

    if (curFuncIndex === 3) {
        const cameraFovTween = gsap.to(camera, {
            fov: 60,
            repeat: 0,
            ease: 'power1.inOut',
            duration: 0.3,
            onUpdate: () => {
                camera.updateProjectionMatrix();
            },
            onComplete: () => {
                cameraFovTween.kill();
            }
        })
        radarGroup.visible = false;
        nameToMeshDic['groundDetail'].visible = true;
        nameToMeshDic['rectAreaLight'].visible = true;

        const killTweens = ['wheelFront', 'wheelBack', 'ground_func4'];
        killTweens.forEach(name => {
            Object.keys(nameToMeshDic[name].userData).forEach(key => {
                if (key.indexOf('ween') > 0) {
                    nameToMeshDic[name].userData[key].kill();
                }
            })
        })

        const wheelFront = nameToMeshDic['wheelFront'];
        const wheelFrontEndTween = gsap.to(wheelFront.rotation, {
            y: wheelFront.rotation.y + 2 * Math.PI,
            repeat: 0,
            duration: 0.3,
            ease: 'power1.out',
            onComplete: () => {
                wheelFrontEndTween.kill();
            }
        });

        const wheelBack = nameToMeshDic['wheelBack'];
        const wheelBackEndTween = gsap.to(wheelBack.rotation, {
            y: wheelFront.rotation.y + 2 * Math.PI,
            repeat: 0,
            duration: 0.3,
            ease: 'power1.in',
            onComplete: () => {
                wheelBackEndTween.kill();
            }
        })
    }
})

window.addEventListener('mousemove', e => {
    if (!(e.target instanceof HTMLCanvasElement)) {
        return ;
    }
    if (nameToMeshDic['camera']) {
        Object.keys(nameToMeshDic['camera'].userData).forEach(key => {
            if (key.indexOf('ween') > 0) {
                nameToMeshDic['camera'].userData[key].kill();
            }
        })
    }
})

const btnElList: Array<HTMLElement> = [];
const funcButtonTunnel = document.getElementById('funcButtonTunnel');
funcButtonTunnel && btnElList.push(funcButtonTunnel);
const funcButtonCarBody = document.getElementById('funcButtonCarBody');
funcButtonCarBody && btnElList.push(funcButtonCarBody);
const funcButtonWindage = document.getElementById('funcButtonWindage');
funcButtonWindage && btnElList.push(funcButtonWindage);
const funcButtonRadar = document.getElementById('funcButtonRadar');
funcButtonRadar && btnElList.push(funcButtonRadar);

funcButtonTunnel?.addEventListener('click', () => {
    changeBtn(0);
    console.log('funcButtonTunnel');
})

funcButtonCarBody?.addEventListener('click', () => {
    changeBtn(1);
    console.log('funcButtonCarBody');
})

funcButtonWindage?.addEventListener('click', () => {
    changeBtn(2);
    const windage = nameToMeshDic['windage'];
    windage.visible = true;
    const windageTween = gsap.to(windage.material.map.offset, {
        x: windage.material.map.offset.x + 1,
        repeat: -1,
        duration: 2,
        ease: 'none'
    })
    windage.userData['tween'] = windageTween;
    windage.material.opacity = 0;
    const windageOpacityTween = gsap.to(windage.material, {
        opacity: 1,
        repeat: 0,
        duration: 1,
        ease: 'none',
        onComplete: () => {
            windageOpacityTween.kill();
        }
    })
    console.log('funcButtonWindage');
})

funcButtonRadar?.addEventListener('click', () => {
    changeBtn(3);
    console.log('funcButtonRadar');
})

window.addEventListener('resize', onWindowResize);

renderer.setAnimationLoop(animationLoop);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.updateProjectionMatrix();
}

function animationLoop() {
    controls.update();
    
    if (ground) {
        ground.visible = false;
        ground_func4.visible = false;
        cubeCamera.position.copy(camera.position);
        cubeCamera.position.y = -cubeCamera.position.y;
        cubeCamera.update(renderer, scene);
        ground.visible = true;
        if (curFuncIndex == 3 && isLeftMouseDown) {
            ground_func4.visible = true;
        }
    }

    // renderer.render(scene, camera);
    effectComposer.render();
}

function changeBtn(index: number) {
    curFuncIndex = index;
    nameToMeshDic['widthHeightDepth'].visible = index === 1;

    // 清除风阻动效
    if (index != 2) {
        const windageTween = nameToMeshDic['windage'].userData['tween'];
        nameToMeshDic['windage'].visible = false;
        if (windageTween) {
            windageTween.kill();
        }
        nameToMeshDic['windage']
    }

    btnElList.forEach((el, i) => {
        if (i === curFuncIndex) {
            el.classList.add("activeBtn");
        } else {
            el.classList.remove("activeBtn");
        }
    })
}