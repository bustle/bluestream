const bluestream = require('bluestream')
const got = require('got')

const download = ({ url }) => got(url, { json: true }).then(resp => resp.body)

let offset = 0
const pokeStream = bluestream.read(async function () {
  const { body: pokemon } = await got(`https://pokeapi.co/api/v2/pokemon/?offset=${offset}`, { json: true })
  if (pokemon.results.length > 0) {
    offset += pokemon.results.length
    pokemon.results.map(monster => this.push(monster))
  } else {
    return null
  }
})
const downloadStream = bluestream.transform({ concurrent: 2 }, download)
const logStream = bluestream.write(pokemon => console.log(pokemon.name))

await bluestream.pipe(pokeStream, downloadStream, logStream)
console.log('caught them all')
