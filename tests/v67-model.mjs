import fs from 'node:fs';
import assert from 'node:assert/strict';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { AnimationMixer,Group,SkinnedMesh,Box3,Vector3 } from 'three';
// Parse actual model geometry and animations without browser-only texture decoding.
const b=fs.readFileSync('public/game-assets/cesium-man.glb'),len=b.readUInt32LE(12);
const j=JSON.parse(b.subarray(20,20+len));delete j.images;delete j.textures;j.materials=[];
for(const mesh of j.meshes)for(const primitive of mesh.primitives)delete primitive.material;
let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const bin=b.subarray(20+len),out=Buffer.alloc(20+json.length+bin.length);b.copy(out,0,0,12);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);bin.copy(out,20+json.length);
const asset=await new GLTFLoader().parseAsync(out.buffer,'');
for(let i=0;i<12;i++){
 const world=new Group(),visual=clone(asset.scene);visual.scale.setScalar(1.15);world.add(visual);world.position.set(i*8,0,i*5);
 const mixer=new AnimationMixer(visual);mixer.clipAction(asset.animations[0]).play();mixer.update(i*.13);world.updateMatrixWorld(true);
 visual.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.update();o.computeBoundingBox();}});
 const size=new Box3().setFromObject(world).getSize(new Vector3());assert(size.y>1&&size.y<2.5,`Animated clone ${i}: ${size.y}m`);
}
console.log('12 animated clones remain at human scale across animation frames and world positions.');
