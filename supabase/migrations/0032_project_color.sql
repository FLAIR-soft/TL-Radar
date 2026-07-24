-- Tsvet proekta (Etap "pravki UI" #4): dat' vozmozhnost' otlichat' proekty
-- drug ot druga po tsvetu, kak uzhe sdelano dlya metok (0028). Nullable —
-- u sushchestvuyushchikh proektov tsveta net, poka ikh yavno ne otredaktiruyut;
-- eto validnoye sostoyaniye ("bez tsveta"), a ne oshibka.
alter table projects add column color text;
