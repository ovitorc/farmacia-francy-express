import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Not found", { status: 404 });

        const requisicaoCondicional = request.headers.get("if-none-match");
        const upstream = await fetch(
          `${url}/storage/v1/object/produtos/${path.split("/").map(encodeURIComponent).join("/")}`,
          { headers: { apikey: key, ...(requisicaoCondicional ? { "if-none-match": requisicaoCondicional } : {}) } },
        );

        if (upstream.status === 304) return new Response(null, { status: 304 });
        if (!upstream.ok) return new Response("Not found", { status: 404 });

        return new Response(await upstream.arrayBuffer(), {
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
            "cache-control": "public, max-age=31536000, immutable",
            ...(upstream.headers.get("etag") ? { etag: upstream.headers.get("etag") as string } : {}),
          },
        });
      },
    },
  },
});
