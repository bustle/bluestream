const bluestream = require('bluestream')
const got = require('got')

const pokeStream = bluestream.read(async function () {
  this.offset = this.offset || 0
  const { body: pokemon } = await got(`https://pokeapi.co/api/v2/pokemon/?offset=${this.offset}`, { json: true })
  if (pokemon.results.length > 0) {
    this.offset += pokemon.results.length
    pokemon.results.map(monster => this.push(monster))
  } else {
    return null
  }
})

const pokedexStream = bluestream.transform({ concurrent: 2 }, ({ url }) => got(url, { json: true }).then(resp => resp.body))
const logStream = bluestream.write(pokemon => console.log(pokemon.name, pokemon.sprites.front_default))

await bluestream.pipe(pokeStream, pokedexStream, logStream)
console.log('caught them all')
