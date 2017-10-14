const bluestream = require('bluestream')
const got = require('got')
const url = id => `https://pokeapi.co/api/v2/pokemon/${id}/`

const download = id => got(url(id), { json: true }).then(resp => resp.body)

const favoritePokemon = [1, 2, 3, 4, 5]
const pokeStream = bluestream.read(() => favoritePokemon.shift() || null)
const downloadStream = bluestream.transform({ concurrent: 2 }, download)
const logStream = bluestream.write(pokemon => console.log(pokemon.name))

await bluestream.pipe(pokeStream, downloadStream, logStream)
console.log('caught them all')
