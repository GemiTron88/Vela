import { inflateSync } from 'node:zlib';
import { sha256 } from './visual-contract.mjs';
export const VISUAL_MAX_PIXELS=24000000;

// Certification captures are PNG. Decode actual pixels, not just file headers.
// Bound decompression and reject unsupported formats instead of guessing.
function crc32(buf){let n=0xffffffff;for(const b of buf){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
export function decodeVisualPNG(bytes,{maxPixels=VISUAL_MAX_PIXELS}={}){
  if(!Buffer.isBuffer(bytes)||bytes.length>64*1024*1024||!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw new Error('VISUAL_IMAGE_CORRUPT: PNG signature');
  let width,height,channels,colorType,palette,transparency,end=false,header=false,offset=8;const chunks=[];
  while(offset+12<=bytes.length){
    const n=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),stop=offset+8+n;
    if(stop+4>bytes.length||crc32(bytes.subarray(offset+4,stop))!==bytes.readUInt32BE(stop))throw new Error('VISUAL_IMAGE_CORRUPT: chunk integrity');
    const data=bytes.subarray(offset+8,stop);
    if(!header&&type!=='IHDR')throw new Error('VISUAL_IMAGE_CORRUPT: missing header');
    if(type==='IHDR'){
      if(header||n!==13)throw new Error('VISUAL_IMAGE_CORRUPT: header');header=true;
      width=data.readUInt32BE(0);height=data.readUInt32BE(4);colorType=data[9];channels=({0:1,2:3,3:1,4:2,6:4})[colorType];
      if(!width||!height||width*height>maxPixels||data[8]!==8||!channels||data[10]||data[11]||data[12])throw new Error('VISUAL_IMAGE_UNSUPPORTED: require bounded non-interlaced 8-bit PNG');
    }else if(type==='PLTE')palette=data;else if(type==='tRNS')transparency=data;else if(type==='IDAT')chunks.push(data);else if(type==='IEND'){if(n!==0)throw new Error('VISUAL_IMAGE_CORRUPT: end');end=true;offset=stop+4;break;}
    offset=stop+4;
  }
  if(!end||offset!==bytes.length||!chunks.length)throw new Error('VISUAL_IMAGE_CORRUPT: incomplete image');
  if(colorType===3&&(!palette||palette.length%3))throw new Error('VISUAL_IMAGE_CORRUPT: palette');
  const stride=width*channels,expected=height*(stride+1),raw=inflateSync(Buffer.concat(chunks),{maxOutputLength:expected});
  if(raw.length!==expected)throw new Error('VISUAL_IMAGE_CORRUPT: pixel count');
  const rgb=Buffer.alloc(width*height*3),prior=Buffer.alloc(stride),line=Buffer.alloc(stride);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const start=y*(stride+1),filter=raw[start];if(filter>4)throw new Error('VISUAL_IMAGE_CORRUPT: filter');
    for(let x=0;x<stride;x++){const a=x>=channels?line[x-channels]:0,b=prior[x],c=x>=channels?prior[x-channels]:0;line[x]=(raw[start+1+x]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}
    for(let x=0;x<width;x++){
      const i=x*channels,o=(y*width+x)*3,idx=line[i];
      const alpha=colorType===6?line[i+3]/255:colorType===4?line[i+1]/255:colorType===3?(transparency?.[idx]??255)/255:1;
      for(let c=0;c<3;c++){const v=colorType===3?palette[idx*3+c]:colorType===0||colorType===4?line[i]:line[i+c];if(v===undefined)throw new Error('VISUAL_IMAGE_CORRUPT: palette index');rgb[o+c]=Math.round(v*alpha+255*(1-alpha));}
    }line.copy(prior);
  }
  return {width,height,rgb};
}
function thumbnail(img,size=32){const values=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++){const p=(Math.min(img.height-1,Math.floor((y+.5)*img.height/size))*img.width+Math.min(img.width-1,Math.floor((x+.5)*img.width/size)))*3;values.push(.2126*img.rgb[p]+.7152*img.rgb[p+1]+.0722*img.rgb[p+2]);}return values;}
export function inspectVisualImage(bytes){
  const img=decodeVisualPNG(bytes),a=thumbnail(img);let sum=0,sum2=0,min=255,max=0;for(let i=0;i<img.rgb.length;i+=3){const v=.2126*img.rgb[i]+.7152*img.rgb[i+1]+.0722*img.rgb[i+2];sum+=v;sum2+=v*v;min=Math.min(min,v);max=Math.max(max,v);}
  const n=img.width*img.height,mean=sum/n,variance=Math.max(0,sum2/n-mean*mean);
  const low=[];for(let v=0;v<8;v++)for(let u=0;u<8;u++){let s=0;for(let y=0;y<32;y++)for(let x=0;x<32;x++)s+=a[y*32+x]*Math.cos((2*x+1)*u*Math.PI/64)*Math.cos((2*y+1)*v*Math.PI/64);low.push(s);}
  const median=[...low.slice(1)].sort((x,y)=>x-y)[31];let hash=0n;for(const x of low)hash=(hash<<1n)|(x>median?1n:0n);
  return {width:img.width,height:img.height,imageSha256:sha256(bytes),perceptualHash:hash.toString(16).padStart(16,'0'),variance,blank:max-min<2||variance<.5};
}
export function compareVisualImages(before,after){
  const a=decodeVisualPNG(before),b=decodeVisualPNG(after);if(a.width!==b.width||a.height!==b.height)throw new Error('VISUAL_COMPARE_DIMENSIONS_MISMATCH');
  let changed=0,error=0,sumA=0,sumB=0,sumAA=0,sumBB=0,sumAB=0;
  const n=a.width*a.height;for(let i=0;i<n;i++){let delta=0;for(let c=0;c<3;c++){const d=Math.abs(a.rgb[i*3+c]-b.rgb[i*3+c]);delta=Math.max(delta,d);error+=d;}if(delta>8)changed++;}
  const ta=thumbnail(a),tb=thumbnail(b);for(let i=0;i<ta.length;i++){sumA+=ta[i];sumB+=tb[i];sumAA+=ta[i]**2;sumBB+=tb[i]**2;sumAB+=ta[i]*tb[i];}
  const k=ta.length,ma=sumA/k,mb=sumB/k,va=sumAA/k-ma*ma,vb=sumBB/k-mb*mb,cov=sumAB/k-ma*mb;
  const ssim=((2*ma*mb+6.5025)*(2*cov+58.5225))/((ma*ma+mb*mb+6.5025)*(va+vb+58.5225));
  const ha=inspectVisualImage(before).perceptualHash,hb=inspectVisualImage(after).perceptualHash;let xor=BigInt('0x'+ha)^BigInt('0x'+hb),distance=0;while(xor){distance+=Number(xor&1n);xor>>=1n;}
  return {identical:sha256(before)===sha256(after),changedPixelRatio:changed/n,meanAbsoluteError:error/(n*3),structuralSimilarity:ssim,perceptualDistance:distance};
}
