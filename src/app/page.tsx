'use client';

import Image from "next/image";
import { FormEvent, Fragment, useMemo, useState } from "react";

import { KANTO_POKEMON } from "@/data/kantoPokemon";

const MIN_POKEMON_ID = 1;
const MAX_POKEMON_ID = 1025;
const TOTAL_POKEMON_COUNT = MAX_POKEMON_ID - MIN_POKEMON_ID + 1;

type PokemonType = {
  slot: number;
  type: {
    name: string;
  };
};

type PokemonSprites = {
  front_default: string | null;
  other?: {
    ["official-artwork"]?: {
      front_default: string | null;
    };
  };
};

type PokemonCries = {
  latest: string | null;
  legacy?: string | null;
};

type PokemonSpecies = {
  name: string;
  url: string;
};

type Pokemon = {
  id: number;
  name: string;
  height: number;
  weight: number;
  sprites: PokemonSprites;
  types: PokemonType[];
  cries: PokemonCries;
  species: PokemonSpecies;
};

const getSpriteUrl = (sprites: PokemonSprites) =>
  sprites.other?.["official-artwork"]?.front_default ?? sprites.front_default ?? "";

const getFormattedName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const formatMeasurement = (value: number, divisor: number, unit: string) =>
  `${(value / divisor).toFixed(1)} ${unit}`;

const formatDexNumber = (id: number) => id.toString().padStart(4, "0");

type EvolutionChainLink = {
  species: {
    name: string;
    url: string;
  };
  evolves_to: EvolutionChainLink[];
};

type EvolutionStageSpecies = {
  id: number;
  name: string;
  artwork: string;
};

type EvolutionStage = {
  species: EvolutionStageSpecies[];
};

const extractIdFromUrl = (url: string) => {
  const segments = url.split("/").filter(Boolean);
  const id = Number(segments[segments.length - 1]);
  return Number.isFinite(id) ? id : null;
};

const getOfficialArtworkUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/other/official-artwork/${id}.png`;

const buildEvolutionStages = (chain: EvolutionChainLink): EvolutionStage[] => {
  const stages: EvolutionStage[] = [];

  const traverse = (node: EvolutionChainLink, level: number) => {
    if (!stages[level]) {
      stages[level] = { species: [] };
    }

    const speciesId = extractIdFromUrl(node.species.url);

    if (speciesId !== null) {
      stages[level]!.species.push({
        id: speciesId,
        name: node.species.name,
        artwork: getOfficialArtworkUrl(speciesId),
      });
    }

    node.evolves_to.forEach((child) => traverse(child, level + 1));
  };

  traverse(chain, 0);

  return stages.filter((stage) => stage.species.length > 0);
};

const hydrateEvolutionStages = async (stages: EvolutionStage[]) => {
  const hydratedStages = await Promise.all(
    stages.map(async (stage) => {
      const speciesWithArtwork = await Promise.all(
        stage.species.map(async (species) => {
          try {
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${species.id}`);

            if (!response.ok) {
              throw new Error("Unable to fetch evolution Pokémon");
            }

            const details: { sprites: PokemonSprites } = await response.json();
            const artwork = getSpriteUrl(details.sprites) || species.artwork;

            return {
              ...species,
              artwork,
            };
          } catch {
            return species;
          }
        })
      );

      return {
        species: speciesWithArtwork,
      };
    })
  );

  return hydratedStages;
};

/**
 * Top-level client React component that provides an interactive Pokédex search UI.
 *
 * Renders a search form with suggestions, displays Pokémon artwork, dex information,
 * typings, measurements, latest cry audio (when available), and a hydrated evolution chain.
 * Includes next/previous navigation that cycles through a defined Pokémon ID range and
 * gracefully handles loading and error states.
 *
 * @returns The component's JSX element representing the Pokédex UI.
 */
export default function Home() {
  const [query, setQuery] = useState("");
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [evolutionStages, setEvolutionStages] = useState<EvolutionStage[] | null>(null);

  const spriteUrl = useMemo(() => (pokemon ? getSpriteUrl(pokemon.sprites) : null), [pokemon]);
  const cryUrl = useMemo(() => pokemon?.cries.latest ?? null, [pokemon]);

  const filteredSuggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return KANTO_POKEMON.slice(0, 6);
    }

    return KANTO_POKEMON.filter(({ name }) => name.includes(normalized)).slice(0, 6);
  }, [query]);

  const fetchEvolutionStages = async (speciesUrl: string, currentPokemonId: number) => {
    try {
      const speciesResponse = await fetch(speciesUrl);

      if (!speciesResponse.ok) {
        throw new Error("Species not found");
      }

      const speciesData = await speciesResponse.json();
      const chainUrl: string | undefined = speciesData.evolution_chain?.url;

      if (!chainUrl) {
        return [];
      }

      const chainResponse = await fetch(chainUrl);

      if (!chainResponse.ok) {
        throw new Error("Evolution chain not found");
      }

      const chainData: { chain: EvolutionChainLink } = await chainResponse.json();
      const baseStages = buildEvolutionStages(chainData.chain);
      const hydratedStages = await hydrateEvolutionStages(baseStages);
      const currentStageIndex = hydratedStages.findIndex((stage) =>
        stage.species.some((species) => species.id === currentPokemonId)
      );

      if (currentStageIndex === -1) {
        return [];
      }

      return hydratedStages.slice(currentStageIndex + 1);
    } catch {
      return null;
    }
  };

  const fetchPokemon = async (identifier: string | number) => {
    const normalized =
      typeof identifier === "number"
        ? identifier.toString()
        : identifier.trim().toLowerCase();

    if (!normalized) {
      setError("Enter a Pokémon name to search.");
      setPokemon(null);
      setEvolutionStages(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvolutionStages(null);

    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${normalized}`);

      if (!response.ok) {
        throw new Error("Pokémon not found");
      }

      const data: Pokemon = await response.json();
      setPokemon(data);
      setQuery(getFormattedName(data.name));

      if (data.species?.url) {
        const stages = await fetchEvolutionStages(data.species.url, data.id);
        setEvolutionStages(stages ?? []);
      } else {
        setEvolutionStages([]);
      }
    } catch {
      setPokemon(null);
      setError("No Pokémon found with that name. Try another search.");
      setEvolutionStages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchPokemon(query);
  };

  const handleSuggestionSelect = (name: string, id?: number) => {
    setQuery(getFormattedName(name));
    void fetchPokemon(id ?? name);
  };

  const handleNavigate = (offset: number) => {
    if (!pokemon) {
      return;
    }

    const targetId =
      ((pokemon.id - MIN_POKEMON_ID + offset + TOTAL_POKEMON_COUNT) % TOTAL_POKEMON_COUNT) +
      MIN_POKEMON_ID;

    void fetchPokemon(targetId);
  };

  return (
    <div
      className="relative flex min-h-screen justify-center overflow-hidden bg-black bg-cover bg-center bg-no-repeat px-4 py-16 text-slate-900"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <main className="relative z-10 flex w-full max-w-3xl flex-col gap-10 overflow-hidden rounded-3xl border-[3px] border-black bg-[#dc0a2d] p-10 text-white shadow-[0_45px_80px_-20px_rgba(220,10,45,0.55)]">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
            Pokédex Search
          </p>
          <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
            Find Pokémon by their name
          </h1>
          <p className="max-w-xl text-base text-white/80">
            Search the PokéAPI for any Pokémon using its name. We&apos;ll fetch dex stats,
            typing, and artwork for you to explore. Powered by the{" "}
            <a
              className="font-semibold text-white underline-offset-4 hover:underline"
              href="https://pokeapi.co/api/v2"
              target="_blank"
              rel="noreferrer"
            >
              PokéAPI
            </a>
            .
          </p>
        </section>

        <form
          onSubmit={handleSearch}
          className="flex w-full flex-col gap-4 rounded-2xl border-[3px] border-white bg-black p-6 shadow-inner shadow-[inset_0_0_30px_rgba(220,10,45,0.35)]"
        >
          <label className="flex flex-col gap-2 text-sm font-medium text-white">
            Pokémon name
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. pikachu"
                className="flex-1 rounded-xl border border-white/40 bg-black px-4 py-3 text-base text-white placeholder:text-white/60 outline-none transition focus:border-white focus:ring-2 focus:ring-white/60"
                aria-label="Pokémon name"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-base font-semibold text-[#dc0a2d] transition hover:bg-[#dc0a2d]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#dc0a2d] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
              >
                {isLoading ? "Searching..." : "Search"}
              </button>
            </div>
          </label>

          {error && (
            <p className="rounded-xl border border-white/70 bg-white/20 px-4 py-3 text-sm text-white">
              {error}
            </p>
          )}

          {filteredSuggestions.length > 0 && (
            <div className="w-full rounded-2xl border border-white/20 bg-black/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
                Suggestions
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {filteredSuggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion.id}
                    onClick={() => handleSuggestionSelect(suggestion.name)}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <span>{getFormattedName(suggestion.name)}</span>
                    <span className="text-xs font-mono text-white/60">
                      #{formatDexNumber(suggestion.id)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        <section className="flex w-full flex-1 flex-col overflow-hidden rounded-2xl border-[3px] border-white bg-black p-6 shadow-inner shadow-[inset_0_0_30px_rgba(220,10,45,0.35)]">
          {isLoading && (
            <div className="flex h-full items-center justify-center text-white/80">
              Fetching Pokémon data...
            </div>
          )}

          {!isLoading && !pokemon && !error && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-lg font-semibold text-white">
                Start by searching for a Pokémon.
              </p>
              <p className="text-sm text-white/80">
                Try popular picks like Pikachu, Charizard, or Gengar.
              </p>
            </div>
          )}

          {!isLoading && pokemon && (
            <article className="grid w-full flex-1 content-start gap-6 md:grid-cols-[200px_1fr] md:items-start">
              <div className="flex w-full items-center justify-between gap-4 md:col-span-2">
                <button
                  type="button"
                  onClick={() => handleNavigate(-1)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
                  aria-label="View previous Pokémon"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate(1)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
                  aria-label="View next Pokémon"
                >
                  Next →
                </button>
              </div>
              {spriteUrl ? (
                <div className="relative h-48 w-48 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 md:self-start">
                  <Image
                    src={spriteUrl}
                    alt={pokemon.name}
                    fill
                    priority
                    sizes="192px"
                    className="object-contain p-6 drop-shadow-[0_12px_24px_rgba(14,165,233,0.35)]"
                  />
                </div>
              ) : (
                <div className="flex h-48 w-48 items-center justify-center rounded-3xl border border-dashed border-white/30 bg-black text-sm text-white/80">
                  No artwork available
                </div>
              )}

              <div className="flex flex-col gap-4">
                <header className="space-y-1">
                  <p className="text-sm uppercase tracking-[0.4em] text-white/70">
                    #{formatDexNumber(pokemon.id)}
                  </p>
                  <h2 className="text-3xl font-bold">{getFormattedName(pokemon.name)}</h2>
                </header>

                <dl className="grid gap-4 rounded-2xl border border-white/20 bg-black/70 p-4 text-sm text-white sm:grid-cols-3">
                  <div className="space-y-1">
                    <dt className="font-semibold text-white/70">Type</dt>
                    <dd className="flex flex-wrap gap-2">
                      {pokemon.types.map(({ type }) => (
                        <span
                          key={type.name}
                          className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
                        >
                          {type.name}
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="font-semibold text-white/70">Height</dt>
                    <dd>{formatMeasurement(pokemon.height, 10, "m")}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="font-semibold text-white/70">Weight</dt>
                    <dd>{formatMeasurement(pokemon.weight, 10, "kg")}</dd>
                  </div>
                </dl>

                {cryUrl && (
                  <div className="rounded-2xl border border-white/20 bg-black/60 p-4 text-sm text-white/80 shadow-inner shadow-black/40">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                      Latest Cry
                    </p>
                    <audio
                      controls
                      preload="none"
                      src={cryUrl}
                      className="mt-3 w-full"
                      aria-label={`Play ${pokemon.name} cry`}
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>

              {evolutionStages !== null && (
                <div className="md:col-span-2">
                  <div className="rounded-2xl border border-white/20 bg-black/60 p-4 text-sm text-white/80 shadow-inner shadow-black/40">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                      Evolution Chain
                    </p>
                    {evolutionStages.length > 0 ? (
                      <div className="mt-4 max-h-[260px] w-full overflow-auto pb-2">
                        <div className="flex items-start gap-6">
                          {evolutionStages.map((stage, stageIndex) => (
                            <Fragment key={`stage-${stageIndex}`}>
                              <div className="flex min-w-[160px] flex-col items-center gap-4">
                                <div className="flex flex-col items-center gap-4">
                                  {stage.species.map((stageSpecies) => (
                                    <button
                                      type="button"
                                      key={stageSpecies.id}
                                      onClick={() =>
                                        handleSuggestionSelect(stageSpecies.name, stageSpecies.id)
                                      }
                                      className="group flex w-36 flex-col items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center text-white transition hover:border-white/40 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                    >
                                      <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-black/60">
                                        <Image
                                          src={stageSpecies.artwork}
                                          alt={stageSpecies.name}
                                          fill
                                          sizes="80px"
                                          className="object-contain p-2 transition group-hover:scale-105"
                                        />
                                      </div>
                                      <span className="text-sm font-semibold">
                                        {getFormattedName(stageSpecies.name)}
                                      </span>
                                      <span className="text-xs font-mono text-white/60">
                                        #{formatDexNumber(stageSpecies.id)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {stageIndex < evolutionStages.length - 1 && (
                                <div className="flex items-center justify-center text-white/40">
                                  <span className="text-3xl font-bold">→</span>
                                </div>
                              )}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-white/70">
                        There are no known evolutions for this Pokémon.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </article>
          )}
        </section>
      </main>
    </div>
  );
}
