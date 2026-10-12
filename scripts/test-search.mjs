import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { normalizeText } from "./search.js";

const source = fs.readFileSync(new URL("./index.js", import.meta.url), "utf8");
const searchFunctions = source.slice(source.indexOf("function editDistance("), source.indexOf("function fillSelect("));
const context = { normalizeText };
vm.createContext(context);
vm.runInContext(searchFunctions, context);

const buildProfile = (name, description) => ({
  nameSearchText: normalizeText(name),
  searchText: normalizeText(`${name} ${description}`),
});
const barbara = buildProfile("Barbara Solis", "Anfitriona para eventos Lima");
const nathalie = buildProfile("Nathalie Miraluz", "Anfitriona para eventos Lima");
assert(context.profileSearchScore(barbara, "b") !== null, "una letra puede encontrar perfiles");
assert(context.profileSearchScore(barbara, "ba") !== null, "dos letras pueden encontrar coincidencias parciales");
assert(context.profileSearchScore({ ...barbara, searchText: "barbara solis anfitriona" }, "zz") === null, "no inventa resultados sin coincidencia");
assert(context.profileSearchScore(buildProfile("Natalie Miraluz", "Diseñadora gráfica"), "disenadora") !== null, "ignora tildes");
assert(context.profileSearchScore(buildProfile("Natalie Miraluz", "Diseñadora gráfica"), "disenadorr") !== null, "tolera un error tipográfico en términos largos");
assert(context.profileSearchScore(barbara, "barbara eventos") !== null, "combina términos de nombre y perfil");
assert(context.profileSearchScore(barbara, "ba") > context.profileSearchScore(nathalie, "ba"), "prioriza coincidencias del nombre frente a la descripción");
console.log("Búsqueda: letras y fragmentos cortos, tildes, términos múltiples, errores tipográficos y relevancia comprobados.");
