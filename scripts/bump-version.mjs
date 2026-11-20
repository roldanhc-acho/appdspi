import { readFileSync, writeFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

const bumpType = process.argv[2] || "patch"
if (!["major", "minor", "patch"].includes(bumpType)) {
  console.error("Uso: npm run version:bump -- <major|minor|patch>")
  process.exit(1)
}

const pkgPath = path.join(rootDir, "package.json")
const manifestPath = path.join(rootDir, "public", "version.json")

const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version)
if (!match) {
  console.error(`Versión actual inválida en package.json: "${pkg.version}" (se esperaba X.Y.Z)`)
  process.exit(1)
}

let [major, minor, patch] = match.slice(1).map(Number)
if (bumpType === "major") {
  major += 1
  minor = 0
  patch = 0
} else if (bumpType === "minor") {
  minor += 1
  patch = 0
} else {
  patch += 1
}

const nextVersion = `${major}.${minor}.${patch}`
pkg.version = nextVersion
manifest.version = nextVersion

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8")
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8")

console.log(`Versión actualizada a v${nextVersion} en package.json y public/version.json.`)
console.log("Siguientes pasos antes de desplegar:")
console.log("  1. Actualizar 'highlights' en public/version.json y registrar la entrada en VERSIONING.md")
console.log(`  2. Confirmar cambios y etiquetar: git tag -a v${nextVersion} -m "Release v${nextVersion}"`)
