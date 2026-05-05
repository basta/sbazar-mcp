#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const BASE_URL = "https://www.sbazar.cz";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "cs-CZ,cs;q=0.9",
};

interface SearchItem {
  id: number;
  name: string;
  price: number | null;
  priceByAgreement: boolean;
  locality: string;
  url: string;
  imageUrl: string | null;
  description: string;
}

interface ItemDetail {
  id: number;
  name: string;
  price: number | null;
  priceByAgreement: boolean;
  description: string;
  category: string;
  locality: string;
  images: string[];
  sellerName: string;
  sellerUrl: string;
  url: string;
  createDate: string;
  editDate: string;
  isReserved: boolean;
  buyerProtection: boolean;
}

function parseLocality(loc: Record<string, string> | null | undefined): string {
  if (!loc) return "";
  return [loc.quarter, loc.municipality, loc.district]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");
}

async function sbazarFetch(path: string): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

async function searchSbazar(
  phrase: string,
  limit: number = 20,
  priceFrom?: number,
  priceTo?: number,
  locality?: string
): Promise<SearchItem[]> {
  const params = new URLSearchParams({ phrase, limit: String(limit) });
  if (priceFrom !== undefined) params.set("price_from", String(priceFrom));
  if (priceTo !== undefined) params.set("price_to", String(priceTo));

  const json = await sbazarFetch(`/api/v1/items/search?${params}`);
  const rawResults: any[] = json.results ?? [];

  const results: SearchItem[] = rawResults.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price ?? null,
    priceByAgreement: item.price_by_agreement ?? false,
    locality: parseLocality(item.locality),
    url: `${BASE_URL}/inzerat/${item.id}-${item.seo_name ?? ""}`,
    imageUrl: item.images?.[0]?.url ? `https:${item.images[0].url}` : null,
    description: (item.description ?? "").slice(0, 200),
  }));

  if (locality) {
    const lowerLoc = locality.toLowerCase();
    return results.filter((r) => r.locality.toLowerCase().includes(lowerLoc));
  }
  return results;
}

async function getItemDetail(idOrUrl: string): Promise<ItemDetail> {
  let itemId: string;
  if (idOrUrl.startsWith("http")) {
    const match = idOrUrl.match(/\/inzerat\/(\d+)/);
    if (!match) throw new Error("Cannot parse item ID from URL");
    itemId = match[1];
  } else {
    itemId = idOrUrl.replace(/\D/g, "");
    if (!itemId) throw new Error("Invalid item ID");
  }

  const json = await sbazarFetch(`/api/v1/items/${itemId}`);
  const item = json.result;
  if (!item) throw new Error(`Item ${itemId} not found or unavailable`);

  const loc = item.localities?.[0]?.locality ?? item.locality ?? {};

  return {
    id: item.id,
    name: item.name,
    price: item.price ?? null,
    priceByAgreement: item.price_by_agreement ?? false,
    description: item.description ?? "",
    category: item.category?.name ?? "",
    locality: parseLocality(loc),
    images: (item.images ?? []).map(
      (img: { url: string }) => `https:${img.url}`
    ),
    sellerName: item.user?.name ?? item.user?.username ?? "",
    sellerUrl: item.user?.username
      ? `${BASE_URL}/bazar/${item.user.username}`
      : "",
    url: `${BASE_URL}/inzerat/${item.id}-${item.seo_name ?? ""}`,
    createDate: item.create_date ?? "",
    editDate: item.edit_date ?? "",
    isReserved: item.is_reserved ?? false,
    buyerProtection: item.buyer_protection ?? false,
  };
}

const server = new Server(
  { name: "sbazar-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "sbazar_search",
      description:
        "Search for items on Sbazar.cz (Czech classifieds marketplace). Returns listings with title, price, location, and URL.",
      inputSchema: {
        type: "object",
        properties: {
          phrase: {
            type: "string",
            description: "Search query (e.g. 'steam deck', 'iPhone 14')",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default 20, max 60)",
          },
          price_from: {
            type: "number",
            description: "Minimum price in CZK",
          },
          price_to: {
            type: "number",
            description: "Maximum price in CZK",
          },
          locality: {
            type: "string",
            description:
              "Filter by city or region (e.g. 'Praha', 'Brno'). Applied client-side to returned results.",
          },
        },
        required: ["phrase"],
      },
    },
    {
      name: "sbazar_get_item",
      description:
        "Get full details of a specific Sbazar.cz listing by ID or URL.",
      inputSchema: {
        type: "object",
        properties: {
          id_or_url: {
            type: "string",
            description:
              "Item ID (numeric) or full Sbazar.cz listing URL (https://www.sbazar.cz/inzerat/...)",
          },
        },
        required: ["id_or_url"],
      },
    },
  ],
}));

const SearchArgsSchema = z.object({
  phrase: z.string(),
  limit: z.number().int().min(1).max(60).optional().default(20),
  price_from: z.number().optional(),
  price_to: z.number().optional(),
  locality: z.string().optional(),
});

const GetItemArgsSchema = z.object({
  id_or_url: z.string(),
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "sbazar_search") {
    const parsed = SearchArgsSchema.parse(args);
    const results = await searchSbazar(
      parsed.phrase,
      parsed.limit,
      parsed.price_from,
      parsed.price_to,
      parsed.locality
    );

    if (results.length === 0) {
      return {
        content: [
          { type: "text", text: `No results found for "${parsed.phrase}".` },
        ],
      };
    }

    const lines = results.map((item, i) => {
      const price = item.priceByAgreement
        ? "Cena dohodou"
        : item.price != null
          ? `${item.price.toLocaleString("cs-CZ")} Kč`
          : "Zdarma";
      return [
        `${i + 1}. **${item.name}**`,
        `   Price: ${price}`,
        `   Location: ${item.locality || "—"}`,
        `   URL: ${item.url}`,
        item.description ? `   ${item.description.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    });

    return {
      content: [
        {
          type: "text",
          text: `Found ${results.length} results for "${parsed.phrase}":\n\n${lines.join("\n\n")}`,
        },
      ],
    };
  }

  if (name === "sbazar_get_item") {
    const parsed = GetItemArgsSchema.parse(args);
    const item = await getItemDetail(parsed.id_or_url);

    const price = item.priceByAgreement
      ? "Cena dohodou"
      : item.price != null
        ? `${item.price.toLocaleString("cs-CZ")} Kč`
        : "Zdarma";

    const text = [
      `# ${item.name}`,
      `**Price:** ${price}`,
      `**Category:** ${item.category}`,
      `**Location:** ${item.locality}`,
      `**Seller:** ${item.sellerName}${item.sellerUrl ? ` (${item.sellerUrl})` : ""}`,
      `**Posted:** ${item.createDate.split("T")[0]}`,
      item.editDate !== item.createDate
        ? `**Updated:** ${item.editDate.split("T")[0]}`
        : "",
      item.isReserved ? "**Status:** Reserved" : "",
      item.buyerProtection ? "**Buyer protection:** Yes" : "",
      `**URL:** ${item.url}`,
      "",
      item.description,
      "",
      item.images.length > 0
        ? `**Images:**\n${item.images.map((u) => `- ${u}`).join("\n")}`
        : "",
    ]
      .filter((l) => l !== "")
      .join("\n");

    return {
      content: [{ type: "text", text }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
