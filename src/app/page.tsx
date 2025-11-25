'use client';

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

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

type Pokemon = {
  id: number;
  name: string;
  height: number;
  weight: number;
  sprites: PokemonSprites;
  types: PokemonType[];
};

const getSpriteUrl = (sprites: PokemonSprites) =>
  sprites.other?.["official-artwork"]?.front_default ?? sprites.front_default ?? "";

const getFormattedName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const formatMeasurement = (value: number, divisor: number, unit: string) =>
  `${(value / divisor).toFixed(1)} ${unit}`;

export default function Home() {
  const [query, setQuery] = useState("");
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const spriteUrl = useMemo(() => (pokemon ? getSpriteUrl(pokemon.sprites) : null), [pokemon]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = query.trim().toLowerCase();

    if (!target) {
      setError("Enter a Pokémon name to search.");
      setPokemon(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${target}`);

      if (!response.ok) {
        throw new Error("Pokémon not found");
      }

      const data: Pokemon = await response.json();
      setPokemon(data);
    } catch {
      setPokemon(null);
      setError("No Pokémon found with that name. Try another search.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen justify-center bg-white px-4 py-16 text-slate-900">
      <main className="flex w-full max-w-3xl flex-col gap-10 rounded-3xl border-[3px] border-black bg-red-600 p-10 text-white shadow-2xl shadow-red-900/40">
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
          className="flex flex-col gap-4 rounded-2xl border-[3px] border-white bg-black p-6 shadow-inner shadow-red-900/40"
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
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-base font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-600 disabled:cursor-not-allowed disabled:opacity-60"
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
        </form>

        <section className="min-h-[220px] rounded-2xl border-[3px] border-white bg-black p-6 shadow-inner shadow-red-900/40">
          {isLoading && (
            <div className="flex h-full items-center justify-center text-white/80">
              Fetching Pokémon data...
            </div>
          )}

          {!isLoading && !pokemon && !error && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-lg font-semibold text-white">
                Start by searching for a Pokémon.
              </p>
              <p className="text-sm text-white/80">
                Try popular picks like Pikachu, Charizard, or Gengar.
              </p>
            </div>
          )}

          {!isLoading && pokemon && (
            <article className="grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
              {spriteUrl ? (
                <div className="relative mx-auto h-48 w-48 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
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
                    #{pokemon.id.toString().padStart(4, "0")}
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
              </div>
            </article>
          )}
        </section>
      </main>
    </div>
  );
}
