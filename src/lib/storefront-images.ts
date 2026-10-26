const PRODUCT_CUTOUTS: Record<string, string> = {
  "vtx-8db7233b": "/storefront/product-cutouts/beige-coord-cutout.webp",
  "vtx-6b1eeb36": "/storefront/product-cutouts/pink-coord-cutout.webp",
  "vtx-f2b3a9a5": "/storefront/product-cutouts/skirt-and-top-cutout.webp",
};

export function storefrontProductImage(id: string | number, fallback?: string): string {
  return fallback || PRODUCT_CUTOUTS[String(id)] || "/product-placeholder.svg";
}

export function storefrontCollectionImage(id: string | number, fallback?: string): string {
  return PRODUCT_CUTOUTS[String(id)] || fallback || "/product-placeholder.svg";
}

const PRODUCT_GALLERY_BEIGE_BACKGROUNDS = new Set([
  "fa1feea757faa71e0d27b3f0dd16b6dcabe198b201ff4ee475d5fd0346bacad0.webp",
  "9b483d39eebe78579e0cf5c6984a1a49a075cf88af62ec0349f4d3559571a546.webp",
  "17679a24b4dd0cb7a6eb3c7627fc640189021699e5aa0188e71d4b7c700a6a25.webp",
  "dbb5e5535c353c094dc7631d060205d7b63d7ac5f7f9ae6f078bdfe8f6da83ae.webp",
  "8a0e972b951b8a4e3d550b7c057e44d7b5a72aade2b14a999f372e06ef534fc0.webp",
  "5014e84fcc812005a6558532dda24584b743fcb01bc4710658530eec745c2d7e.webp",
  "0fb052894cb0d0d636b2b6b098547dc9129ccd03027766e8f17ae4d73f4ca539.webp",
  "9ddc1d1cdb43267450bbbec003dceb0c4fc468de9221731eb1730ae4af6fbc87.webp",
  "52c1b37ec5298f7d74f819b026f5ccb64c59a20f08706a9bbcd336bb4f7290c6.webp",
  "4cd351791364950c009ee4fd8a54085700bbdbf570be61a473488fd5b993c646.webp",
  "8ab390e9f4e4d0fddd38d0eb227e880ae28c21a6ff86ab0fa4379d25250cf5d9.webp",
  "9fd4c31c48e01974715239b244fd8fb8622bfad8352baaf05e974fdb4e35c8e4.webp",
  "642ffafebfec42f39416434a1fa9fe1acedee256b63ea76d4facdb826e993b1c.webp",
  "8e44d622ce151d5eb6a8f56e1ae021e0602054ae808f080d40447a1923a1dde8.webp",
  "347226dd3e6c20c9f1e2d37ec557f5428c39037707abbc569920c95423d48d70.webp",
  "55664b986733d169b5ef96f78da2512ac7f12b98320d768abbc99fdc67ca43d6.webp",
  "e1366e8dd7c94462fcc515f5ca136d182ad4cae740b7c20fdddc4fde71ad1f1d.webp",
  "064018e4f0f324029db6766db25f2859961608cc7771d046c53874e95819b39b.webp",
]);

export function storefrontProductGalleryImage(source: string): string {
  const filename = source.split(/[?#]/, 1)[0].split("/").pop() || "";
  return PRODUCT_GALLERY_BEIGE_BACKGROUNDS.has(filename)
    ? `/storefront/product-beige-background/${filename}`
    : source;
}
