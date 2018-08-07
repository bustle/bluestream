const { read, transform, write, pipe } = require('bluestream')
const got = require('got')

const pokeStream = read(async function () {
  this.offset = this.offset || 0
  const { body: pokemon } = await got(`https://pokeapi.co/api/v2/pokemon/?offset=${this.offset}`, { json: true })
  if (pokemon.results.length > 0) {
    this.offset += pokemon.results.length
    for (const monster of pokemon.results) {
      this.push(monster)
    }
  } else {
    return null
  }
})

const pokedexStream = transform({ concurrent: 2 }, ({ url }) => got(url, { json: true }).then(resp => resp.body))
const logStream = write(pokemon => console.log(`<h1>${pokemon.name}</h1><img src="${pokemon.sprites.front_default}">`))

await pipe(pokeStream, pokedexStream, logStream)
console.log('caught them all')
