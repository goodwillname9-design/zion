import type { MetadataRoute } from "next";
export default function sitemap():MetadataRoute.Sitemap{return ["/","/about","/privacy","/safety"].map(path=>({url:`https://zion-one-nu.vercel.app${path}`}));}
