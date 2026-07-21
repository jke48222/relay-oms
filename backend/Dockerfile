# Build stage — compile a self-contained BEAM release. The final image has
# no Elixir/Mix toolchain, just the runtime: this is the same shape Stord
# ships to GKE.
FROM hexpm/elixir:1.20.2-erlang-29.0-alpine-3.22.2 AS build

RUN apk add --no-cache build-base git

WORKDIR /app

ENV MIX_ENV=prod

RUN mix local.hex --force && mix local.rebar --force

COPY mix.exs mix.lock ./
RUN mix deps.get --only prod && mix deps.compile

COPY config config
COPY priv priv
COPY lib lib

RUN mix compile && mix release

# Runtime stage — minimal Alpine with just the release.
FROM alpine:3.22.2 AS app

RUN apk add --no-cache libstdc++ openssl ncurses-libs

WORKDIR /app

RUN addgroup -S relay && adduser -S relay -G relay
USER relay

COPY --from=build --chown=relay:relay /app/_build/prod/rel/relay ./

ENV HOME=/app PHX_SERVER=true

# Expects at runtime: DATABASE_URL, SECRET_KEY_BASE, PHX_HOST
EXPOSE 4000

CMD ["bin/relay", "start"]
