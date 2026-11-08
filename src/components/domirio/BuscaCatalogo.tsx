"use client";

import { Search } from "lucide-react";
import { registrarEventoFunil } from "@/lib/eventos-loja";
import styles from "./comercial.module.css";

export default function BuscaCatalogo() {
  return <form action="/produtos" method="get" role="search" className={styles.busca} onSubmit={() => registrarEventoFunil("search")}>
    <label htmlFor="busca-domirio">Qual produto você procura?</label>
    <div><Search size={20} aria-hidden="true" /><input id="busca-domirio" type="search" name="q" required maxLength={150} placeholder="Nome, marca ou código do produto" /><button type="submit">Buscar</button></div>
  </form>;
}
