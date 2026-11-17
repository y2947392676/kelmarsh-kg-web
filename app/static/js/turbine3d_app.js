import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const MODEL_SCALE = 0.0003;

const FAULT_LABEL_MAP = {
    gearbox: "Gearbox",
    generator: "Generator",
    blade: "Blade / Rotor",
    shaft: "Main Shaft",
    pitch: "Pitch System",
    cooling: "Cooling Unit",
    control: "Control Cabinet",
    yaw: "Yaw Motor"
};

const PART_LABEL_MAP = {
    rotor: "Rotor",
    pitch: "Pitch System",
    shaft: "Main Shaft",
    gearbox: "Gearbox",
    generator: "Generator",
    oilcool: "Oil Cooling Unit",
    yaw: "Yaw Motor",
    fancool: "Air Cooling Unit",
    control: "Control Cabinet",
    unknown: "Unknown Part"
};

const PART_CLASSIFIERS = [
    { alias: "rotor", keywords: ["rotor", "blade", "转子", "叶片"] },
    { alias: "pitch", keywords: ["pitch", "变桨系统", "桨距系统"] },
    { alias: "shaft", keywords: ["shaft", "main shaft", "主轴"] },
    { alias: "gearbox", keywords: ["gearbox", "齿轮箱"] },
    { alias: "generator", keywords: ["generator", "发电机"] },
    { alias: "oilcool", keywords: ["oil", "oil cooler", "lubrication", "油冷装置", "油冷器"] },
    { alias: "yaw", keywords: ["yaw", "偏航电机", "偏航"] },
    { alias: "fancool", keywords: ["air", "fan", "air cooler", "cooling", "风冷装置", "风冷器"] },
    { alias: "control", keywords: ["control", "cabinet", "converter", "sensor", "控制柜", "变流器", "传感器"] }
];

const FAULT_TO_PARTS = {
    gearbox: ["gearbox"],
    generator: ["generator"],
    blade: ["rotor"],
    shaft: ["shaft"],
    pitch: ["pitch"],
    cooling: ["oilcool", "fancool"],
    control: ["control"],
    yaw: ["yaw"]
};

// Refined industrial PBR palette
const PART_COLOR_MAP = {
    rotor: 0xcfd8dc,
    pitch: 0xd7ccc8,
    shaft: 0xb0bec5,
    gearbox: 0xd1b373,     // Metallic warm bronze/brass for gearbox
    generator: 0x90a4ae,   // Metallic steel blue for generator
    oilcool: 0xb0bec5,
    yaw: 0x78909c,
    fancool: 0xb0bec5,
    control: 0x607d8b,
    unknown: 0x9e9e9e
};

function safeText(value, fallback = "") {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

const VIEWER_TEXT = {
    "wb.btn_explode": ["机械解构", "Explode"], "wb.btn_collapse": ["还原装配", "Assemble"],
    "wb.btn_view_toggle": ["整机全貌", "Whole turbine"], "wb.btn_view_nacelle": ["机舱特写", "Nacelle"],
    "wb.btn_reset": ["复位视点", "Reset view"], "wb.selected_part_prefix": ["已选定部件", "Selected part"],
    "wb.turbine": ["风机", "Turbine"], "wb.load_failed": ["3D 模型加载失败，请检查模型文件或刷新重试。", "The 3D model could not be loaded."]
};
const PART_LABEL_ZH = {
    "Rotor": "转子", "Pitch System": "变桨系统", "Main Shaft": "主轴", "Gearbox": "齿轮箱", "Generator": "发电机",
    "Oil Cooling Unit": "油冷装置", "Yaw Motor": "偏航电机", "Air Cooling Unit": "风冷装置", "Control Cabinet": "控制柜", "Unknown Part": "未知部件"
};
const viewerLang = () => (window.kgI18n?.lang?.() === "en" ? "en" : "zh");

function localText(value) {
    const text = safeText(value, "");
    return viewerLang() === "zh" && PART_LABEL_ZH[text] ? PART_LABEL_ZH[text] : text;
}

function getI18n(key, fallback) {
    const entry = VIEWER_TEXT[key];
    return entry ? entry[viewerLang() === "en" ? 1 : 0] : fallback;
}

function resolveContainerAndData(containerInput, turbineData = {}) {
    let container = null;
    let data = turbineData || {};

    if (containerInput && typeof containerInput === "object" && containerInput.container) {
        container = containerInput.container;
        data = containerInput.turbineData || {};
    } else if (typeof containerInput === "string") {
        container = document.getElementById(containerInput);
    } else if (containerInput instanceof HTMLElement) {
        container = containerInput;
    }

    return { container, turbineData: data };
}

export function initTurbine3D(containerInput, turbineData = {}) {
    const resolved = resolveContainerAndData(containerInput, turbineData);
    const container = resolved.container;
    turbineData = resolved.turbineData;

    if (!container) return;

    if (typeof container.__turbine3dCleanup === "function") {
        container.__turbine3dCleanup();
    }

    container.innerHTML = "";
    container.style.position = "relative";
    container.style.overflow = "hidden";

    ensureViewerStyles();

    const rawStatusText = String(turbineData.status || "").toLowerCase() === "fault" ? "Fault" : "Normal";
    const statusText = localText(rawStatusText);
    const faultAlias = normalizeAlias(turbineData.fault_part || turbineData.fault_type);
    const faultLabel = getFaultLabel(faultAlias, turbineData.fault_part || turbineData.fault_type || "None");

    const state = {
        disposed: false,
        clock: new THREE.Clock(),
        mixers: [],
        allMeshes: [],
        clickableMeshes: [],
        faultMeshes: [],
        selectedMesh: null,
        selectedBackup: null,
        isExploded: false,
        isWholeView: false,
        pointerDown: null,
        pointerMoved: false,
        tween: null,
        nacelleView: null,
        wholeView: null,
        defaultView: null,
        explodeView: null,
        skeletonModel: null,
        equipmentModel: null,
        partTagElements: [],
        faultAlias,
        onPartSelect: turbineData.onPartSelect
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070d18);
    scene.fog = new THREE.Fog(0x070d18, 5, 25);

    const camera = new THREE.PerspectiveCamera(
        38,
        Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
        0.01,
        100
    );

    camera.position.set(0.95, 0.42, 0.95);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));

    if ("outputColorSpace" in renderer) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    window.__turbine3dState = state;
    window.__turbine3dCamera = camera;
    window.__turbine3dContainer = container;

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minPolarAngle = THREE.MathUtils.degToRad(15);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(96);
    controls.target.set(0, 0, 0);

    addLights(scene);
    addStage(scene);

    const rootGroup = new THREE.Group();
    rootGroup.name = "wind-turbine-root";
    scene.add(rootGroup);

    const ui = createViewerUI(container, {
        turbineName: safeText(turbineData.display_name || turbineData.name || turbineData.id, "Turbine"),
        rawStatusText,
        statusText,
        faultType: safeText(turbineData.display_fault_type || turbineData.fault_type, "None"),
        faultLabel: localText(faultLabel)
    }, state);

    startRenderLoop(renderer, scene, camera, controls, state, container);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/static/vendor/draco/");
    dracoLoader.setDecoderConfig({ type: "js" });

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    Promise.all([
        loadModel(loader, "/static/models/skeleton.glb?v=80"),
        loadModel(loader, "/static/models/equipment.glb?v=80")
    ]).then(([skeletonGltf, equipmentGltf]) => {
        if (state.disposed) return;

        const skeletonModel = skeletonGltf.scene;
        const equipmentModel = equipmentGltf.scene;

        state.skeletonModel = skeletonModel;
        state.equipmentModel = equipmentModel;

        skeletonModel.name = "skeleton";
        equipmentModel.name = "equipment";

        skeletonModel.scale.setScalar(MODEL_SCALE);
        equipmentModel.scale.setScalar(MODEL_SCALE);

        prepareSkeletonModel(skeletonModel);
        prepareEquipmentModel(equipmentModel, state);

        rootGroup.add(skeletonModel);
        rootGroup.add(equipmentModel);

        if (skeletonGltf.animations?.length) {
            const mixer = new THREE.AnimationMixer(skeletonModel);
            skeletonGltf.animations.forEach((clip) => mixer.clipAction(clip).play());
            state.mixers.push(mixer);
        }

        // Build Nacelle (close-up 3/4) and Whole Turbine views
        state.nacelleView = getNacelleView(equipmentModel, camera);
        state.wholeView = getWholeView(rootGroup, camera);
        state.defaultView = state.nacelleView;

        // Default view: Nacelle close-up with unobstructed solid machinery!
        // Hide wireframe cage in nacelle view to eliminate clutter:
        skeletonModel.visible = false;
        applyView(camera, controls, state.nacelleView);

        controls.minDistance = state.nacelleView.minDistance;
        controls.maxDistance = state.nacelleView.maxDistance;
        controls.update();

        buildExplodeLayout(state, equipmentModel, container);

        // Bind UI toolbar actions
        ui.faultFocusBtn.addEventListener("click", () => {
            selectFaultPart(state, ui);
            focusFaultPart(camera, controls, state);
        });

        ui.explodeBtn.addEventListener("click", () => {
            toggleExplode(camera, controls, state, ui);
        });

        ui.resetBtn.addEventListener("click", () => {
            resetView(camera, controls, state, ui);
        });

        ui.viewToggleBtn.addEventListener("click", () => {
            toggleWholeView(camera, controls, state, ui);
        });

        bindClickFocus(renderer.domElement, camera, controls, state, ui);

        // Highlight fault part immediately on load
        if (state.faultMeshes.length > 0) {
            selectFaultPart(state, ui);
        }
    }).catch((err) => {
        console.error("Wind turbine model loading failed:", err);
        container.innerHTML = `
            <div class="viewer-error">
                ${getI18n("wb.load_failed", "3D 模型加载失败")}
            </div>
        `;
    });

    const resize = () => {
        const w = Math.max(container.clientWidth, 1);
        const h = Math.max(container.clientHeight, 1);

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    window.addEventListener("resize", resize);

    container.__turbine3dCleanup = () => {
        state.disposed = true;

        if (ui && typeof ui.unsubscribe === "function") {
            ui.unsubscribe();
        }

        resizeObserver.disconnect();
        window.removeEventListener("resize", resize);

        if (typeof state.stopRenderLoop === "function") {
            state.stopRenderLoop();
        }
        controls.dispose();
        dracoLoader.dispose();

        rootGroup.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();

            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach((m) => m.dispose && m.dispose());
                } else {
                    obj.material.dispose && obj.material.dispose();
                }
            }
        });

        renderer.dispose();
        container.innerHTML = "";
    };
}

function loadModel(loader, url) {
    return new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
    });
}

function prepareSkeletonModel(model) {
    model.traverse((obj) => {
        if (!obj.isMesh) return;

        obj.material = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            wireframe: true,
            transparent: true,
            opacity: 0.18,
            depthWrite: false
        });
    });
}

function prepareEquipmentModel(model, state) {
    const faultPartAliases = FAULT_TO_PARTS[state.faultAlias] || [];

    model.traverse((obj) => {
        if (!obj.isMesh) return;

        const alias = classifyPartByObject(obj);
        const partAlias = alias || "unknown";
        const baseColor = PART_COLOR_MAP[partAlias] || PART_COLOR_MAP.unknown;

        obj.material = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.38,
            metalness: 0.55,
            emissive: 0x000000,
            emissiveIntensity: 0
        });

        obj.userData.partAlias = partAlias;
        obj.userData.partLabel = localText(getPartLabel(partAlias, obj.name || "Unknown Part"));
        obj.userData.baseColor = baseColor;
        obj.userData.originPosition = obj.position.clone();
        obj.userData.explodeOffset = new THREE.Vector3();
        obj.userData.isFault = false;

        state.allMeshes.push(obj);
        state.clickableMeshes.push(obj);

        if (faultPartAliases.includes(partAlias)) {
            markFaultMesh(obj);
            state.faultMeshes.push(obj);
        }
    });
}

function markFaultMesh(mesh) {
    mesh.userData.isFault = true;

    // Subdued, professional fault highlight
    mesh.material.color.set(0xef4444);
    mesh.material.emissive.set(0x991b1b);
    mesh.material.emissiveIntensity = 1.25;
    mesh.material.roughness = 0.28;
    mesh.material.metalness = 0.45;
}

function normalizeAlias(value) {
    const text = String(value || "").trim().toLowerCase();

    if (!text || text === "none" || text === "-") return "";

    if (text.includes("gearbox") || text.includes("齿轮")) return "gearbox";
    if (text.includes("generator") || text.includes("发电")) return "generator";
    if (text.includes("blade") || text.includes("rotor") || text.includes("叶片") || text.includes("转子")) return "blade";
    if (text.includes("shaft") || text.includes("主轴")) return "shaft";
    if (text.includes("pitch") || text.includes("变桨")) return "pitch";
    if (text.includes("cooling") || text.includes("lubrication") || text.includes("oil") || text.includes("air") || text.includes("冷")) return "cooling";
    if (text.includes("control") || text.includes("cabinet") || text.includes("converter") || text.includes("sensor") || text.includes("控制")) return "control";
    if (text.includes("yaw") || text.includes("偏航")) return "yaw";

    return text.replace(/[^a-z0-9]+/g, "");
}

function classifyPartByObject(obj) {
    let current = obj;
    const names = [];

    while (current) {
        if (current.name) names.push(current.name);
        current = current.parent;
    }

    const merged = names.join("|").toLowerCase();

    for (const item of PART_CLASSIFIERS) {
        if (item.keywords.some((keyword) => merged.includes(keyword.toLowerCase()))) {
            return item.alias;
        }
    }

    return "unknown";
}

function getFaultLabel(alias, fallback = "") {
    const key = String(alias || "").trim().toLowerCase();
    return FAULT_LABEL_MAP[key] || safeText(fallback, "Unspecified");
}

function getPartLabel(alias, fallback = "") {
    const key = String(alias || "").trim().toLowerCase();
    return PART_LABEL_MAP[key] || safeText(fallback, "Unknown Part");
}

function addLights(scene) {
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));

    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.1);
    hemi.position.set(0, 8, 0);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xf8fafc, 2.0);
    key.position.set(4, 5, 4);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x93c5fd, 1.0);
    fill.position.set(-4, 3, 2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rim.position.set(0, 2, -5);
    scene.add(rim);
}

function addStage(scene) {
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1.45, 64),
        new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide
        })
    );

    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.45;
    scene.add(ring);

    const grid = new THREE.GridHelper(8, 20, 0x0284c7, 0x1e293b);
    grid.material.transparent = true;
    grid.material.opacity = 0.2;
    grid.position.y = -0.45;
    scene.add(grid);
}

// --------------------------------------------------------------------------
// View Calculations: Nacelle 3/4 Isometric vs Whole Turbine
// --------------------------------------------------------------------------
function getNacelleView(equipmentModel, camera) {
    equipmentModel.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(equipmentModel);

    if (box.isEmpty()) {
        return {
            position: new THREE.Vector3(0.95, 0.38, 0.95),
            target: new THREE.Vector3(0, 0, 0),
            near: 0.005,
            far: 40,
            minDistance: 0.15,
            maxDistance: 2.2
        };
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.35);

    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fitDist = maxDim / (2 * Math.tan(fov / 2));
    const distance = Math.max(fitDist * 1.15, 0.85);

    // 3/4 isometric perspective focusing directly on nacelle drivetrain machinery
    const offset = new THREE.Vector3(1.1, 0.42, 0.95).normalize().multiplyScalar(distance);

    return {
        position: center.clone().add(offset),
        target: center.clone(),
        near: 0.005,
        far: 40,
        minDistance: 0.15,
        maxDistance: Math.max(2.2, distance * 2.0)
    };
}

function getWholeView(rootGroup, camera) {
    rootGroup.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(rootGroup);

    if (box.isEmpty()) {
        return {
            position: new THREE.Vector3(1.5, 0.8, 1.8),
            target: new THREE.Vector3(0, 0.5, 0),
            near: 0.01,
            far: 50,
            minDistance: 0.4,
            maxDistance: 4.5
        };
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1.0);

    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fitDist = maxDim / (2 * Math.tan(fov / 2));
    const distance = Math.max(fitDist * 1.35, 1.8);

    const offset = new THREE.Vector3(1.1, 0.35, 1.4).normalize().multiplyScalar(distance);

    return {
        position: center.clone().add(offset),
        target: center.clone(),
        near: 0.01,
        far: 60,
        minDistance: 0.4,
        maxDistance: distance * 2.2
    };
}

function applyView(camera, controls, view) {
    if (!view) return;

    camera.position.copy(view.position);
    controls.target.copy(view.target);
    camera.near = view.near ?? camera.near;
    camera.far = view.far ?? camera.far;
    camera.updateProjectionMatrix();
    camera.lookAt(view.target);
    controls.minDistance = view.minDistance ?? controls.minDistance;
    controls.maxDistance = view.maxDistance ?? controls.maxDistance;
    controls.update();
}

function tweenToView(camera, controls, state, view, duration = 650) {
    if (!view) return;

    camera.near = view.near ?? camera.near;
    camera.far = view.far ?? camera.far;
    camera.updateProjectionMatrix();

    controls.minDistance = view.minDistance ?? controls.minDistance;
    controls.maxDistance = view.maxDistance ?? controls.maxDistance;

    state.tween = {
        start: performance.now(),
        duration,
        fromPos: camera.position.clone(),
        toPos: view.position.clone(),
        fromTarget: controls.target.clone(),
        toTarget: view.target.clone()
    };
}

// --------------------------------------------------------------------------
// Exploded View Layout: Axial drive-line displacement with labels
// --------------------------------------------------------------------------
function buildExplodeLayout(state, equipmentModel, container) {
    const worldBox = new THREE.Box3().setFromObject(equipmentModel);
    if (worldBox.isEmpty()) return;

    const centerWorld = worldBox.getCenter(new THREE.Vector3());

    // Tight axial displacement along drivetrain drive axis (Z in local GLTF space)
    // Scaled to local units (divide by MODEL_SCALE 0.0003)
    // 100 units in local = 0.03m in world
    const layoutOffsets = {
        rotor:    new THREE.Vector3(0, 0, 520),    // +0.156m along drive axis to front
        pitch:    new THREE.Vector3(0, 0, 420),    // +0.126m forward
        shaft:    new THREE.Vector3(0, 0, 260),    // +0.078m forward
        gearbox:  new THREE.Vector3(0, 0, 0),      // Remains centered
        generator:new THREE.Vector3(0, 0, -320),   // -0.096m rearward along drive line
        control:  new THREE.Vector3(120, 0, -420), // -0.126m rearward & slight lateral
        oilcool:  new THREE.Vector3(0, 320, 0),    // +0.096m upward
        fancool:  new THREE.Vector3(0, 320, -120), // +0.096m upward & rearward
        yaw:      new THREE.Vector3(0, -300, 0),   // -0.090m downward
        unknown:  new THREE.Vector3(0, 0, 0)
    };

    state.allMeshes.forEach((mesh) => {
        const alias = mesh.userData.partAlias || "unknown";
        const offset = layoutOffsets[alias] || layoutOffsets.unknown;
        mesh.userData.explodeOffset.copy(offset);
    });

    // Create 3D exploded camera view tightly framing the expanded machinery
    const fov = THREE.MathUtils.degToRad(cameraFov || 38);
    const distance = 1.15;
    const offset = new THREE.Vector3(1.15, 0.55, 0.95).normalize().multiplyScalar(distance);

    state.explodeView = {
        position: centerWorld.clone().add(offset),
        target: centerWorld.clone(),
        near: 0.005,
        far: 40,
        minDistance: 0.25,
        maxDistance: 2.5
    };

    createPartTags(state, container);
}

const cameraFov = 38;

function createPartTags(state, container) {
    const tagLayer = document.createElement("div");
    tagLayer.className = "viewer-part-tags-layer";
    container.appendChild(tagLayer);

    const mainAliases = ["rotor", "shaft", "gearbox", "generator", "oilcool", "yaw"];
    state.partTagElements = [];

    mainAliases.forEach((alias) => {
        const mesh = state.allMeshes.find((m) => m.userData.partAlias === alias);
        if (!mesh) return;

        const tag = document.createElement("div");
        tag.className = "viewer-part-tag";
        tag.textContent = localText(getPartLabel(alias));
        tagLayer.appendChild(tag);

        state.partTagElements.push({
            element: tag,
            mesh,
            alias
        });
    });
}

function updatePartTags(state, camera, container) {
    if (!state.partTagElements || !state.partTagElements.length) return;

    const visible = state.isExploded;
    const w = container.clientWidth;
    const h = container.clientHeight;

    state.partTagElements.forEach((item) => {
        if (!visible) {
            item.element.style.display = "none";
            return;
        }

        if (!item.mesh.geometry.boundingBox) {
            item.mesh.geometry.computeBoundingBox();
        }

        const geomCenter = new THREE.Vector3();
        item.mesh.geometry.boundingBox.getCenter(geomCenter);
        const wp = geomCenter.applyMatrix4(item.mesh.matrixWorld);
        wp.y += 0.045;

        const proj = wp.project(camera);

        if (proj.z > 1 || proj.z < -1 || proj.x < -1.1 || proj.x > 1.1 || proj.y < -1.1 || proj.y > 1.1) {
            item.element.style.display = "none";
            return;
        }

        const screenX = ((proj.x + 1) * w) / 2;
        const screenY = ((-proj.y + 1) * h) / 2;

        item.element.style.display = "block";
        item.element.style.left = `${Math.round(screenX)}px`;
        item.element.style.top = `${Math.round(screenY)}px`;
        item.element.style.transform = "translate(-50%, -120%)";
        item.element.textContent = localText(getPartLabel(item.alias));
    });
}

function bindClickFocus(dom, camera, controls, state, ui) {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    dom.addEventListener("pointerdown", (event) => {
        state.pointerDown = { x: event.clientX, y: event.clientY };
        state.pointerMoved = false;
    });

    dom.addEventListener("pointermove", (event) => {
        if (!state.pointerDown) return;

        const dx = event.clientX - state.pointerDown.x;
        const dy = event.clientY - state.pointerDown.y;

        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            state.pointerMoved = true;
        }
    });

    dom.addEventListener("pointerup", (event) => {
        if (!state.pointerDown || state.pointerMoved) {
            state.pointerDown = null;
            return;
        }

        const rect = dom.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(state.clickableMeshes, false);

        if (!intersects.length) {
            state.pointerDown = null;
            return;
        }

        const mesh = intersects[0].object;
        const label = mesh.userData.partLabel || mesh.name || "Unknown Part";

        setSelectedMesh(state, ui, mesh, label);
        focusMesh(camera, controls, state, mesh, 1.6);
        if (typeof state.onPartSelect === "function") {
            state.onPartSelect(mesh.userData.partAlias, getPartLabel(mesh.userData.partAlias, label));
        }

        state.pointerDown = null;
    });
}

function setSelectedMesh(state, ui, mesh, label) {
    clearSelectedMesh(state);

    state.selectedMesh = mesh;
    state.selectedBackup = {
        color: mesh.material?.color ? mesh.material.color.clone() : null,
        emissive: mesh.material?.emissive ? mesh.material.emissive.clone() : null,
        emissiveIntensity: mesh.material?.emissiveIntensity ?? 0
    };

    if (mesh.material) {
        if (mesh.userData.isFault) {
            if (mesh.material.color) mesh.material.color.set(0xdc2626);
            if (mesh.material.emissive) {
                mesh.material.emissive.set(0x991b1b);
                mesh.material.emissiveIntensity = 0.82;
            }
        } else {
            if (mesh.material.color) {
                mesh.material.color.lerp(new THREE.Color(0x38bdf8), 0.4);
            }
            if (mesh.material.emissive) {
                mesh.material.emissive.set(0x0284c7);
                mesh.material.emissiveIntensity = 1.2;
            }
        }
    }

    if (ui.selectedBadge) {
        if (mesh.userData.isFault) {
            ui.selectedBadge.textContent = `${localText("🎯 定位故障部件")}: ${localText(label)}`;
            ui.selectedBadge.style.background = "rgba(185, 28, 28, 0.4)";
            ui.selectedBadge.style.borderColor = "#ef4444";
            ui.selectedBadge.style.color = "#fecaca";
        } else {
            ui.selectedBadge.textContent = `${getI18n("wb.selected_part_prefix", "已选定部件")}: ${localText(label)}`;
            ui.selectedBadge.style.background = "rgba(15, 23, 42, 0.88)";
            ui.selectedBadge.style.borderColor = "rgba(56, 189, 248, 0.45)";
            ui.selectedBadge.style.color = "#bae6fd";
        }
        ui.selectedBadge.classList.add("is-visible");
    }
}

function clearSelectedMesh(state) {
    const mesh = state.selectedMesh;
    const backup = state.selectedBackup;

    if (mesh && backup && mesh.material) {
        if (backup.color && mesh.material.color) {
            mesh.material.color.copy(backup.color);
        }
        if (backup.emissive && mesh.material.emissive) {
            mesh.material.emissive.copy(backup.emissive);
            mesh.material.emissiveIntensity = backup.emissiveIntensity;
        }
    }

    state.selectedMesh = null;
    state.selectedBackup = null;
}

function selectFaultPart(state, ui) {
    const mesh = state.faultMeshes[0];

    if (!mesh) {
        if (ui.selectedBadge) {
            ui.selectedBadge.textContent = localText("已选定部件: 无");
            ui.selectedBadge.classList.remove("is-visible");
        }
        return "None";
    }

    const label = mesh.userData.partLabel || localText("Fault Part");
    setSelectedMesh(state, ui, mesh, label);
    return label;
}

function focusFaultPart(camera, controls, state) {
    // Hide skeleton wireframe during close-up fault inspection
    if (state.skeletonModel) {
        state.skeletonModel.visible = false;
    }

    const meshes = state.faultMeshes.length ? state.faultMeshes : state.allMeshes;
    focusMeshes(camera, controls, state, meshes, 1.95);
}

function focusMesh(camera, controls, state, mesh, multiplier = 1.95) {
    focusMeshes(camera, controls, state, [mesh], multiplier);
}

function focusMeshes(camera, controls, state, meshes, multiplier = 1.95) {
    const box = new THREE.Box3();
    meshes.forEach((mesh) => box.expandByObject(mesh));

    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.12);

    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fitDist = maxDim / (2 * Math.tan(fov / 2));
    const distance = Math.max(fitDist * multiplier, 0.48);

    // 3/4 isometric perspective retaining adjacent shaft & generator context without edge clipping
    const offset = new THREE.Vector3(1.15, 0.40, 0.95).normalize().multiplyScalar(distance);

    const view = {
        position: center.clone().add(offset),
        target: center.clone(),
        near: 0.005,
        far: 40,
        minDistance: 0.12,
        maxDistance: 2.0
    };

    tweenToView(camera, controls, state, view, 700);
}

function toggleExplode(camera, controls, state, ui) {
    state.isExploded = !state.isExploded;

    const span = ui.explodeBtn.querySelector("span");
    if (span) {
        span.textContent = state.isExploded
            ? getI18n("wb.btn_collapse", "还原装配")
            : getI18n("wb.btn_explode", "机械解构");
    }
    ui.explodeBtn.classList.toggle("is-active", state.isExploded);

    if (state.skeletonModel) {
        state.skeletonModel.visible = false;
    }

    if (state.isExploded) {
        tweenToView(camera, controls, state, state.explodeView, 750);
    } else {
        tweenToView(camera, controls, state, state.defaultView, 750);
    }
}

function toggleWholeView(camera, controls, state, ui) {
    state.isWholeView = !state.isWholeView;

    if (state.skeletonModel) {
        state.skeletonModel.visible = state.isWholeView;
    }

    const span = ui.viewToggleBtn.querySelector("span");
    if (span) {
        span.textContent = state.isWholeView
            ? getI18n("wb.btn_view_nacelle", "机舱特写")
            : getI18n("wb.btn_view_toggle", "整机全貌");
    }
    ui.viewToggleBtn.classList.toggle("is-active", state.isWholeView);

    if (state.isWholeView) {
        tweenToView(camera, controls, state, state.wholeView, 750);
    } else {
        tweenToView(camera, controls, state, state.nacelleView, 750);
    }
}

function resetView(camera, controls, state, ui) {
    state.isExploded = false;
    state.isWholeView = false;

    if (state.skeletonModel) {
        state.skeletonModel.visible = false;
    }

    const explodeSpan = ui.explodeBtn.querySelector("span");
    if (explodeSpan) explodeSpan.textContent = getI18n("wb.btn_explode", "机械解构");
    ui.explodeBtn.classList.remove("is-active");

    const viewSpan = ui.viewToggleBtn.querySelector("span");
    if (viewSpan) viewSpan.textContent = getI18n("wb.btn_view_toggle", "整机全貌");
    ui.viewToggleBtn.classList.remove("is-active");

    const resetSpan = ui.resetBtn.querySelector("span");
    if (resetSpan) resetSpan.textContent = getI18n("wb.btn_reset", "复位视点");

    clearSelectedMesh(state);
    if (ui.selectedBadge) {
        ui.selectedBadge.classList.remove("is-visible");
    }

    // Re-highlight fault mesh if any
    if (state.faultMeshes.length > 0) {
        selectFaultPart(state, ui);
    }

    tweenToView(camera, controls, state, state.defaultView, 700);
}

function startRenderLoop(renderer, scene, camera, controls, state, container) {
    let animId = null;

    function renderFrame() {
        if (state.disposed) return;
        animId = requestAnimationFrame(renderFrame);
        window.__frameCount = (window.__frameCount || 0) + 1;

        const delta = state.clock.getDelta();
        const elapsed = state.clock.getElapsedTime();

        state.mixers.forEach((mixer) => mixer.update(delta));

        const explodeTarget = state.isExploded ? 1 : 0;
        const lerpFactor = state.isExploded ? 0.18 : 0.16;

        state.allMeshes.forEach((mesh) => {
            const origin = mesh.userData.originPosition;
            if (!origin) return;
            const offset = mesh.userData.explodeOffset || new THREE.Vector3();
            const target = origin.clone().add(offset.clone().multiplyScalar(explodeTarget));
            mesh.position.lerp(target, lerpFactor);
        });

        // Subdued breathing pulse for fault mesh
        state.faultMeshes.forEach((mesh) => {
            if (mesh === state.selectedMesh) return;
            if (!mesh.material || !mesh.material.emissive) return;
            mesh.material.emissiveIntensity = 0.65 + Math.sin(elapsed * 2.2) * 0.15;
        });

        if (state.tween) {
            const now = performance.now();
            const t = Math.min((now - state.tween.start) / state.tween.duration, 1);
            const eased = easeInOutCubic(t);

            camera.position.lerpVectors(state.tween.fromPos, state.tween.toPos, eased);
            controls.target.lerpVectors(state.tween.fromTarget, state.tween.toTarget, eased);

            if (t >= 1) {
                state.tween = null;
            }
        }

        controls.update();
        renderer.render(scene, camera);

        // Update 3D part tag overlay positions
        updatePartTags(state, camera, container);
    }

    animId = requestAnimationFrame(renderFrame);

    state.stopRenderLoop = () => {
        if (animId) cancelAnimationFrame(animId);
    };
}

function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createViewerUI(container, info, state) {
    const top = document.createElement("div");
    top.className = "viewer-ui-top";
    container.appendChild(top);

    const selectedBadge = document.createElement("div");
    selectedBadge.className = "viewer-selected-badge";
    container.appendChild(selectedBadge);

    const toolbar = document.createElement("div");
    toolbar.className = "viewer-toolbar";
    toolbar.innerHTML = `
        <button type="button" id="focusFaultBtn" class="viewer-tool-btn" data-role="fault-focus">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>
            <span></span>
        </button>
        <button type="button" id="explodeBtn" class="viewer-tool-btn" data-role="explode">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span></span>
        </button>
        <button type="button" id="viewToggleBtn" class="viewer-tool-btn" data-role="view-toggle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            <span></span>
        </button>
        <button type="button" id="resetViewBtn" class="viewer-tool-btn" data-role="reset">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
            <span></span>
        </button>
    `;
    container.appendChild(toolbar);

    const faultFocusBtn = toolbar.querySelector('[data-role="fault-focus"]');
    faultFocusBtn.style.display = "none";
    const explodeBtn = toolbar.querySelector('[data-role="explode"]');
    const viewToggleBtn = toolbar.querySelector('[data-role="view-toggle"]');
    const resetBtn = toolbar.querySelector('[data-role="reset"]');

    function updateTexts() {
        top.innerHTML = `
            <div class="viewer-chip">
                <span class="viewer-chip-label">${getI18n("wb.turbine", "风机")}:</span>
                <span class="viewer-chip-value">${escapeHtml(info.turbineName)}</span>
            </div>
        `;

        faultFocusBtn.querySelector("span").textContent = getI18n("wb.btn_fault_focus", "定位故障");
        explodeBtn.querySelector("span").textContent = state && state.isExploded
            ? getI18n("wb.btn_collapse", "还原装配")
            : getI18n("wb.btn_explode", "机械解构");
        viewToggleBtn.querySelector("span").textContent = state && state.isWholeView
            ? getI18n("wb.btn_view_nacelle", "机舱特写")
            : getI18n("wb.btn_view_toggle", "整机全貌");
        resetBtn.querySelector("span").textContent = getI18n("wb.btn_reset", "复位视点");

        if (state && state.selectedMesh) {
            const rawLabel = state.selectedMesh.userData.partLabel || state.selectedMesh.userData.partAlias || "Part";
            const localizedLabel = localText(rawLabel);
            if (state.selectedMesh.userData.isFault) {
                selectedBadge.textContent = `${getI18n("wb.fault_part_prefix", "定位故障部件")}: ${localizedLabel}`;
                selectedBadge.style.background = "rgba(185, 28, 28, 0.4)";
                selectedBadge.style.borderColor = "#ef4444";
                selectedBadge.style.color = "#fecaca";
            } else {
                selectedBadge.textContent = `${getI18n("wb.selected_part_prefix", "已选定部件")}: ${localizedLabel}`;
                selectedBadge.style.background = "rgba(15, 23, 42, 0.88)";
                selectedBadge.style.borderColor = "rgba(56, 189, 248, 0.45)";
                selectedBadge.style.color = "#bae6fd";
            }
        }
    }

    updateTexts();

    let unsubscribe = null;
    if (window.kgI18n?.onChange) {
        window.kgI18n.onChange(updateTexts);
    }

    return {
        top,
        selectedBadge,
        toolbar,
        faultFocusBtn,
        explodeBtn,
        viewToggleBtn,
        resetBtn,
        updateTexts,
        unsubscribe
    };
}

function ensureViewerStyles() {
    if (document.getElementById("turbine3d-enhanced-style")) return;

    const style = document.createElement("style");
    style.id = "turbine3d-enhanced-style";
    style.textContent = `
        .viewer-ui-top {
            position: absolute;
            top: 12px;
            left: 12px;
            z-index: 20;
            display: flex;
            gap: 8px;
            pointer-events: none;
        }

        .viewer-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 26px;
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid rgba(14, 165, 233, 0.4);
            background: rgba(14, 23, 42, 0.88);
            color: #F8FAFC;
            font-size: 12px;
            backdrop-filter: blur(8px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .viewer-chip.is-fault {
            border-color: rgba(239, 68, 68, 0.55);
            background: rgba(127, 29, 29, 0.88);
            color: #FFFFFF;
        }

        .viewer-chip.is-normal {
            border-color: rgba(16, 185, 129, 0.55);
            background: rgba(6, 78, 59, 0.88);
            color: #FFFFFF;
        }

        .viewer-chip-label {
            color: rgba(255, 255, 255, 0.82);
            font-size: 11.5px;
            font-weight: 500;
        }

        .viewer-chip-value {
            color: #FFFFFF;
            font-weight: 700;
        }

        .viewer-selected-badge {
            position: absolute;
            left: 14px;
            bottom: 14px;
            z-index: 22;
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid rgba(14, 165, 233, 0.4);
            background: rgba(14, 23, 42, 0.92);
            color: #FFFFFF;
            font-size: 12px;
            font-weight: 600;
            opacity: 0;
            transform: translateY(4px);
            transition: all 0.2s ease;
            pointer-events: none;
            backdrop-filter: blur(8px);
            max-width: 280px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .viewer-selected-badge.is-visible {
            opacity: 1;
            transform: translateY(0);
        }

        .viewer-toolbar {
            position: absolute;
            right: 12px;
            bottom: 12px;
            z-index: 24;
            display: flex;
            gap: 6px;
            align-items: center;
            justify-content: flex-end;
        }

        .viewer-tool-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            height: 32px;
            padding: 0 10px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            background: rgba(15, 23, 42, 0.85);
            color: #F1F5F9;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(6px);
            transition: all 0.15s ease;
        }

        .viewer-tool-btn:hover {
            background: rgba(30, 41, 59, 0.95);
            border-color: #38BDF8;
            color: #FFFFFF;
            box-shadow: 0 0 10px rgba(14, 165, 233, 0.35);
        }

        .viewer-tool-btn.is-active {
            background: rgba(3, 105, 161, 0.9);
            border-color: #38BDF8;
            color: #FFFFFF;
        }

        .viewer-part-tags-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden;
            z-index: 30;
        }

        .viewer-part-tag {
            position: absolute;
            display: none;
            padding: 3px 8px;
            border-radius: 4px;
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(56, 189, 248, 0.6);
            color: #F8FAFC;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
            pointer-events: none;
        }

        .viewer-error {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FCA5A5;
            font-size: 13px;
            text-align: center;
            padding: 20px;
        }
    `;

    document.head.appendChild(style);
}

export default initTurbine3D;
