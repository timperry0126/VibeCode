'use client';

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";

import Home from "./page";

const jsonResponse = (data: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => data,
  } as Response);

describe("Home page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the main heading and search controls", () => {
    render(<Home />);

    expect(screen.getByText(/pokédex search/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /find pokémon by their name or id/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/pokémon name or id/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("shows default suggestion buttons", () => {
    render(<Home />);

    expect(screen.getByRole("button", { name: /bulbasaur/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /charmander/i })).toBeInTheDocument();
  });

  it("does not render navigation controls before a Pokémon is selected", () => {
    render(<Home />);

    expect(screen.queryByRole("button", { name: /previous/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("loads Pokémon data after searching and displays navigation", async () => {
    const user = userEvent.setup();

    const pokemonData = {
      id: 1,
      name: "bulbasaur",
      height: 7,
      weight: 69,
      sprites: {
        front_default: "https://example.com/bulbasaur.png",
        other: {
          "official-artwork": {
            front_default: "https://example.com/bulbasaur-art.png",
          },
        },
      },
      types: [
        {
          slot: 1,
          type: { name: "grass" },
        },
        {
          slot: 2,
          type: { name: "poison" },
        },
      ],
      cries: {
        latest: "https://example.com/bulbasaur.ogg",
      },
      species: {
        name: "bulbasaur",
        url: "https://pokeapi.co/api/v2/pokemon-species/1/",
      },
    };

    const speciesData = {
      evolution_chain: {
        url: "https://pokeapi.co/api/v2/evolution-chain/1/",
      },
    };

    const chainData = {
      chain: {
        species: {
          name: "bulbasaur",
          url: "https://pokeapi.co/api/v2/pokemon-species/1/",
        },
        evolves_to: [
          {
            species: {
              name: "ivysaur",
              url: "https://pokeapi.co/api/v2/pokemon-species/2/",
            },
            evolves_to: [
              {
                species: {
                  name: "venusaur",
                  url: "https://pokeapi.co/api/v2/pokemon-species/3/",
                },
                evolves_to: [],
              },
            ],
          },
        ],
      },
    };

    const hydratedPokemon = (id: number, name: string) => ({
      sprites: {
        front_default: `https://example.com/${name}.png`,
        other: {
          "official-artwork": {
            front_default: `https://example.com/${name}-art.png`,
          },
        },
      },
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/pokemon/bulbasaur")) {
        return jsonResponse(pokemonData);
      }

      if (url.includes("/pokemon-species/1")) {
        return jsonResponse(speciesData);
      }

      if (url.includes("/evolution-chain/1")) {
        return jsonResponse(chainData);
      }

      if (url.includes("/pokemon/1")) {
        return jsonResponse(hydratedPokemon(1, "bulbasaur"));
      }

      if (url.includes("/pokemon/2")) {
        return jsonResponse(hydratedPokemon(2, "ivysaur"));
      }

      if (url.includes("/pokemon/3")) {
        return jsonResponse(hydratedPokemon(3, "venusaur"));
      }

      return Promise.reject(new Error(`Unhandled fetch call for URL: ${url}`));
    });

    render(<Home />);

    const input = screen.getByLabelText(/pokémon name or id/i);
    await user.clear(input);
    await user.type(input, "bulbasaur");
    await user.click(screen.getByRole("button", { name: /search/i }));

    expect(fetchMock).toHaveBeenCalledWith("https://pokeapi.co/api/v2/pokemon/bulbasaur");

    await screen.findByRole("heading", { name: /bulbasaur/i });

    expect(screen.getByText(/grass/i)).toBeInTheDocument();
    expect(screen.getByText(/poison/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("shows a message when no further evolutions exist", async () => {
    const user = userEvent.setup();

    const pokemonData = {
      id: 151,
      name: "mew",
      height: 4,
      weight: 40,
      sprites: {
        front_default: "https://example.com/mew.png",
        other: {
          "official-artwork": {
            front_default: "https://example.com/mew-art.png",
          },
        },
      },
      types: [
        {
          slot: 1,
          type: { name: "psychic" },
        },
      ],
      cries: {
        latest: "https://example.com/mew.ogg",
      },
      species: {
        name: "mew",
        url: "https://pokeapi.co/api/v2/pokemon-species/151/",
      },
    };

    const speciesData = {
      evolution_chain: {
        url: "https://pokeapi.co/api/v2/evolution-chain/151/",
      },
    };

    const chainData = {
      chain: {
        species: {
          name: "mew",
          url: "https://pokeapi.co/api/v2/pokemon-species/151/",
        },
        evolves_to: [],
      },
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/pokemon/mew")) {
        return jsonResponse(pokemonData);
      }

      if (url.includes("/pokemon-species/151")) {
        return jsonResponse(speciesData);
      }

      if (url.includes("/evolution-chain/151")) {
        return jsonResponse(chainData);
      }

      return Promise.reject(new Error(`Unhandled fetch call for URL: ${url}`));
    });

    render(<Home />);

    const input = screen.getByLabelText(/pokémon name or id/i);
    await user.clear(input);
    await user.type(input, "mew");
    await user.click(screen.getByRole("button", { name: /search/i }));

    expect(fetchMock).toHaveBeenCalledWith("https://pokeapi.co/api/v2/pokemon/mew");

    await screen.findByRole("heading", { name: /mew/i });

    expect(screen.getByText(/there are no known evolutions for this pokémon/i)).toBeInTheDocument();
  });
});

