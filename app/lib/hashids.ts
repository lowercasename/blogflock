import Hashids from "npm:hashids";

const hashids = new Hashids("Blogflock", 5);

export const encode = (id: number) => hashids.encode(id);

export const decode = (hash: string) => Number(hashids.decode(hash)[0]);
