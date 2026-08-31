import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const esquema = z.object({
  cep: z.string().trim().max(20),
  rua: z.string().trim().max(200),
  numero: z.string().trim().max(30),
  bairro: z.string().trim().max(120),
  cidade: z.string().trim().max(120),
  estado: z.string().trim().max(40),
});

export const unidadeMaisProximaDoEndereco = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => esquema.parse(input))
  .handler(async ({ data }) => {
    const { resolverUnidadeMaisProxima } = await import("@/lib/geo.server");
    return await resolverUnidadeMaisProxima(data);
  });
