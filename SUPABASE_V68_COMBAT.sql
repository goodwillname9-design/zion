-- Additive private forest arena. Requires V63; V67 feed is independent.
begin;
create table if not exists public.zion_forest_cover(id integer primary key,x double precision,z double precision,w double precision,d double precision);
alter table public.zion_forest_cover enable row level security;
revoke all on public.zion_forest_cover from anon,authenticated;
insert into public.zion_forest_cover values
(0,24.69879323244095,-73.84340936737135,0.3,0.3),
(1,-23.24040665337816,9.466647583059967,0.3,0.3),
(2,104.10863608773798,104.8353039198555,0.3,0.3),
(3,98.9918440473266,112.56423816271126,0.3,0.3),
(4,-96.22503705415875,-14.451211725827307,0.3,0.3),
(5,23.365106457378715,-30.822669831104577,0.3,0.3),
(6,17.873332572169602,22.251052469480783,0.3,0.3),
(7,-30.918898311909288,-53.86126894503832,0.3,0.3),
(8,-111.11241121124476,27.079964675474912,0.3,0.3),
(9,-53.619238992687315,53.56705901026726,0.3,0.3),
(10,-62.44197157584131,100.61408461024985,0.3,0.3),
(11,-25.645265970844775,-26.988758536987007,0.3,0.3),
(12,-91.66356491856277,-26.044708831701428,0.3,0.3),
(13,57.12928145425394,54.564003905281425,0.3,0.3),
(14,30.568737559951842,-62.761659297626466,0.3,0.3),
(15,-76.49449121905491,104.35496449284256,0.3,0.3),
(16,95.61077721603215,94.29687777301297,0.3,0.3),
(17,62.84971188334748,22.023990829475224,0.3,0.3),
(18,-11.085534901358187,-100.63032137369737,0.3,0.3),
(19,-89.35382117470726,-111.8394677452743,0.3,0.3),
(20,17.92634136788547,-109.28325857454911,0.3,0.3),
(21,-52.197926114778966,96.38515940494835,0.3,0.3),
(22,-22.836268271319568,-94.09295634133741,0.3,0.3),
(23,-103.56273195659742,-73.05869345366955,0.3,0.3),
(24,-99.04969885665923,-30.638018847908825,0.3,0.3),
(25,-76.87348805414513,20.64803594443947,0.3,0.3),
(26,-12.516286600381136,-34.602137547452,0.3,0.3),
(27,56.32066834485158,-72.17192405555397,0.3,0.3),
(28,-60.99863250181079,-31.41371474089101,0.3,0.3),
(29,-33.65403796499595,7.80767697840929,0.3,0.3),
(30,-61.41166040766984,-34.68871478131041,0.3,0.3),
(31,-59.731644491199404,95.80464817490429,0.3,0.3),
(32,-91.44659579452127,-23.513513657730073,0.3,0.3),
(33,-73.01724526425824,-18.82212757691741,0.3,0.3),
(34,-63.84502256754786,-54.83788573509082,0.3,0.3),
(35,-18.63850488839671,-53.99799667112529,0.3,0.3),
(36,-19.702175120823085,-75.69162618322298,0.3,0.3),
(37,-82.55297917919233,-54.316883257590234,0.3,0.3),
(38,8.813188154250383,-60.63618451775983,0.3,0.3),
(39,110.6487111938186,29.35125276632607,0.3,0.3),
(40,-71.37084061838686,-13.128958533052355,0.3,0.3),
(41,109.28706866363063,95.31869164481759,0.3,0.3),
(42,12.211621968075633,-62.59222704404965,0.3,0.3),
(43,-58.13894569454715,-23.23085422627628,0.3,0.3),
(44,-15.071581292897463,-66.50019828649238,0.3,0.3),
(45,18.04215354239568,110.97651803400367,0.3,0.3),
(46,-100.84608008619398,53.8958898303099,0.3,0.3),
(47,31.286983920726925,-63.73799015209079,0.3,0.3),
(48,-90.97784423083067,73.18303844286129,0.3,0.3),
(49,-10.927192833740264,-52.30021965038031,0.3,0.3),
(50,71.72406347002834,16.098810786847025,0.3,0.3),
(51,-89.02390191564336,93.01522559206933,0.3,0.3),
(52,-76.0466982498765,-107.05301381694153,0.3,0.3),
(53,-27.028832404408604,-67.90658636856824,0.3,0.3),
(54,27.28396971989423,-22.950631193351,0.3,0.3),
(55,58.29307676339522,-51.04904770851135,0.3,0.3),
(56,68.5138482041657,76.53340076981112,0.3,0.3),
(57,8.131032926496118,-101.06666218582541,0.3,0.3),
(58,-51.45935675315559,23.55181555589661,0.3,0.3),
(59,-83.11500994069502,71.42982648871839,0.3,0.3),
(60,-50.76373092830181,112.12793029053137,0.3,0.3),
(61,68.26663005212322,-104.26112773641944,0.3,0.3),
(62,59.739664105698466,25.746899602469057,0.3,0.3),
(63,66.83572722924873,-63.7823728909716,0.3,0.3),
(64,65.98167503997684,110.99727930454537,0.3,0.3),
(65,106.6713841012679,112.97252482082695,0.3,0.3),
(66,-26.351198052987456,-94.58778708288446,0.3,0.3),
(67,59.7418620842509,68.33714958745986,0.3,0.3),
(68,30.450070396997035,-63.221076648216695,0.3,0.3),
(69,-53.80937258293852,-28.547253880649805,0.3,0.3),
(70,-104.35087404586375,-25.26982949161902,0.3,0.3),
(71,96.40254690917209,-17.25464846752584,0.3,0.3),
(72,-62.64973508939147,53.05169252632186,0.3,0.3),
(73,-10.018865344580263,-58.48632559925318,0.3,0.3),
(74,17.02654890343547,91.66485278634354,0.3,0.3),
(75,-26.58273942070082,55.017119833268225,0.3,0.3),
(76,66.63644070085138,-13.191053492482752,0.3,0.3),
(77,7.394262896385044,28.798967177979648,0.3,0.3),
(78,-92.78956337366253,-60.623183762189,0.3,0.3),
(79,-28.78782195178792,106.01706207729876,0.3,0.3),
(80,27.617213282734156,65.29080493329093,0.3,0.3),
(81,13.00744348531589,16.218757293187082,0.3,0.3),
(82,-25.8426853409037,-32.46570586739108,0.3,0.3),
(83,104.15592022566125,-63.5350193483755,0.3,0.3),
(84,-71.48077869508415,52.193926910404116,0.3,0.3),
(85,74.56968660326675,-107.05533555708826,0.3,0.3),
(86,32.34797517769039,18.734006953891367,0.3,0.3),
(87,71.42556371213868,-96.2106904964894,0.3,0.3),
(88,-105.41394309792668,49.71628546202555,0.3,0.3),
(89,95.85171183617786,-14.004524191841483,0.3,0.3),
(90,-8.743846195749938,102.7623811964877,0.3,0.3),
(91,-53.166804490145296,110.10740276426077,0.3,0.3),
(92,-97.28922311775386,9.241282613482326,0.3,0.3),
(93,14.503684747498482,27.205691774375737,0.3,0.3),
(94,28.220081686973572,-111.17862845258787,0.3,0.3),
(95,65.56278387596831,66.1825080094859,0.3,0.3),
(96,-28.89882594626397,-20.906843170057982,0.3,0.3),
(97,-99.0648761219345,18.424498833715916,0.3,0.3),
(98,-106.09818443469703,-73.0948022142984,0.3,0.3),
(99,-97.08321473514661,73.34434194862843,0.3,0.3),
(100,104.28183970227838,30.581796776037663,0.3,0.3),
(101,98.70502960449085,14.753776988945901,0.3,0.3),
(102,20.804430187679827,19.50950962724164,0.3,0.3),
(103,91.78558380017057,62.226340781897306,0.3,0.3),
(104,50.433458485640585,105.83717275829986,0.3,0.3),
(105,111.5544568435289,19.628836799412966,0.3,0.3),
(106,-49.2462603431195,-22.14626912632957,0.3,0.3),
(107,55.32167359581217,-15.90656888205558,0.3,0.3),
(108,99.3611150206998,53.33119219588116,0.3,0.3),
(109,-81.1655431962572,99.56261184066534,0.3,0.3),
(110,-86.95248101186007,-57.104904524516314,0.3,0.3),
(111,17.124461215455085,-102.84398276172578,0.3,0.3),
(112,-85.10992765706033,99.01799352513626,0.3,0.3),
(113,-86.83025986002758,-16.94215054716915,0.3,0.3),
(114,100.03258460294455,-64.76242185523733,0.3,0.3),
(115,-91.05130384070799,63.825907399877906,0.3,0.3),
(116,-100.37616488989443,53.48801034362987,0.3,0.3),
(117,91.93840747931972,-34.93912347778678,0.3,0.3),
(118,-8.123536141589284,30.35528295999393,0.3,0.3),
(119,-22.17248658882454,99.11209869477898,0.3,0.3),
(120,-50.0913456575945,-63.77934562554583,0.3,0.3),
(121,-84.12085493607447,25.288892513141036,0.3,0.3),
(122,74.64742693305016,21.66709717316553,0.3,0.3),
(123,32.72912473836914,69.70649575069547,0.3,0.3),
(124,-14.856684438884258,102.68572804285213,0.3,0.3),
(125,-86.35330603877082,-53.382823144085705,0.3,0.3),
(126,72.3581798877567,98.72903009271249,0.3,0.3),
(127,-17.82675101282075,102.62174640316516,0.3,0.3),
(128,111.46018760558218,-49.87445646291599,0.3,0.3),
(129,102.80671015800908,-95.42287806980312,0.3,0.3),
(130,72.63521621748805,-33.37422383995727,0.3,0.3),
(131,-110.3587841889821,-67.900803565979,0.3,0.3),
(132,100.3590299077332,7.608531470876187,0.3,0.3),
(133,-85.40525223547593,73.8741062944755,0.3,0.3),
(134,20.013025517575443,60.65100412676111,0.3,0.3),
(135,33.55420445417985,33.52045558299869,0.3,0.3),
(136,-13.497714675031602,107.83190488489345,0.3,0.3),
(137,107.5421143756248,-98.71755125746131,0.3,0.3),
(138,-90.29996177740395,7.473828551825136,0.3,0.3),
(139,111.69025677861646,62.01578842289746,0.3,0.3),
(140,-57.31411839555949,-27.571006796788424,0.3,0.3),
(141,107.1057575144805,-61.62184748053551,0.3,0.3),
(142,-54.8829054357484,31.180922760162503,0.3,0.3),
(143,50.69433777080849,-26.07068313844502,0.3,0.3),
(144,53.13004166632891,49.95600798679516,0.3,0.3),
(145,-26.852792902383953,58.245521212928,0.3,0.3),
(146,-78.65871816407889,-91.50070155365393,0.3,0.3),
(147,95.57497733319178,-57.50310708582401,0.3,0.3),
(148,66.25360010005534,59.05790647258982,0.3,0.3),
(149,-69.99129933072254,107.83289092592895,0.3,0.3),
(150,28.36997213214636,107.214622780215,0.3,0.3),
(151,93.41206488152966,-99.35170998144895,0.3,0.3),
(152,-78.50968720950186,52.248965775128454,0.3,0.3),
(153,109.89716880721971,-21.739800742827356,0.3,0.3),
(154,-68.77841429039836,-98.69536346616223,0.3,0.3),
(155,33.48229612642899,-105.68879391998053,0.3,0.3),
(156,27.894445463083684,33.185801232699305,0.3,0.3),
(157,-33.83271497813985,11.452373633161187,0.3,0.3),
(158,-21.725318636745214,-22.652466465253383,0.3,0.3),
(159,98.85071352357045,11.279182963073254,0.3,0.3),
(160,-97.24702293984592,-33.50758516648784,0.3,0.3),
(161,76.714617210906,61.56434517074376,0.3,0.3),
(162,-67.72459578607231,22.550549844745547,0.3,0.3),
(163,22.049482297617942,19.872804367914796,0.3,0.3),
(164,-21.820282297208905,107.96060020988807,0.3,0.3),
(165,-68.4846190516837,92.82435806188732,0.3,0.3),
(166,20.32917335256934,-57.3739526537247,0.3,0.3),
(167,105.40570258582011,-99.5519759207964,0.3,0.3),
(168,112.42251966614276,-112.1013518567197,0.3,0.3),
(169,-84.86030667787418,-14.621626652777195,0.3,0.3),
(170,-9.178969545289874,-66.93101176479831,0.3,0.3),
(171,66.8780596931465,-112.33790346421301,0.3,0.3),
(172,-62.74932812806219,-64.05100085167214,0.3,0.3),
(173,111.40460596838966,93.1008956618607,0.3,0.3),
(174,64.5040974682197,-21.81034974521026,0.3,0.3),
(175,-50.24743675859645,18.680759106762707,0.3,0.3),
(176,51.96280429046601,76.16294979909435,0.3,0.3),
(177,26.99606862710789,104.48289862088859,0.3,0.3),
(178,22.396058909595013,-72.69214449869469,0.3,0.3),
(179,22.1634497824125,107.60043202806264,0.3,0.3),
(180,-56.621862969361246,100.89228583546355,0.3,0.3),
(181,-15.521590815391392,71.39937250688672,0.3,0.3),
(182,74.92197035066783,34.04930723970756,0.3,0.3),
(183,-24.87052807258442,-12.388656719587743,0.3,0.3),
(184,-12.450213168747723,110.27665205905214,0.3,0.3),
(185,60.303081028629094,-52.69945929385722,0.3,0.3),
(186,101.90712033212185,-9.177813016343862,0.3,0.3),
(187,53.32974389055744,13.30079198256135,0.3,0.3),
(188,-85.14239686913788,67.2027601278387,0.3,0.3),
(189,110.93885383429006,17.029883520677686,0.3,0.3),
(190,22.19418575335294,-33.60753833455965,0.3,0.3),
(191,-7.34316272335127,-66.5807244097814,0.3,0.3),
(192,94.33455618005246,-33.52303631743416,0.3,0.3),
(193,-16.31897561205551,102.47070516459644,0.3,0.3),
(194,-89.0467626079917,8.821294486057013,0.3,0.3),
(195,62.03406046470627,-68.15362292993814,0.3,0.3),
(196,104.6011767135933,23.020555757451802,0.3,0.3),
(197,-68.06039040582255,-17.988889909349382,0.3,0.3),
(198,-88.11637219414115,-111.07509093405679,0.3,0.3),
(199,97.39449587697163,-49.3990219309926,0.3,0.3),
(200,51.79755056928843,49.21270669111982,0.3,0.3),
(201,21.805368130560964,33.73888385202736,0.3,0.3),
(202,-103.88177182432264,-22.89451878098771,0.3,0.3),
(203,12.784231767524034,18.7341998051852,0.3,0.3),
(204,-73.14033727254719,73.45277525903657,0.3,0.3),
(205,-98.57731595309451,8.514537219889462,0.3,0.3),
(206,-16.017660067416728,-70.27235496556386,0.3,0.3),
(207,74.23352959146723,-72.80540114361793,0.3,0.3),
(208,-25.163721341639757,-105.91483105393127,0.3,0.3),
(209,-88.44160487735644,26.99288013484329,0.3,0.3),
(210,102.71913541201502,-95.77695383457467,0.3,0.3),
(211,29.66852545319125,-108.31866497080773,0.3,0.3),
(212,9.4071599310264,96.23555357987061,0.3,0.3),
(213,91.53233884787187,19.67211578693241,0.3,0.3),
(214,-64.53179638646543,-99.02881950745359,0.3,0.3),
(215,15.091479915659875,72.95797561574727,0.3,0.3),
(216,-58.18960675597191,-51.83412227826193,0.3,0.3),
(217,-101.91318028280511,-27.05887432117015,0.3,0.3),
(218,16.19453106634319,105.17456675833091,0.3,0.3),
(219,103.5843079383485,-66.477558596991,0.3,0.3),
(220,81.65633184835315,52.983474591746926,1.5,1.3),
(221,22.29522722773254,10.314836073666811,1.5,1.3),
(222,-97.94488046318293,-54.939384991303086,1.5,1.3),
(223,51.77001082338393,-75.52061229944229,1.5,1.3),
(224,-9.410749934613705,18.678681692108512,1.5,1.3),
(225,-27.70300447009504,-96.30199037492275,1.5,1.3),
(226,74.44188566878438,26.956427888944745,1.5,1.3),
(227,-83.73664119280875,-85.46786541119218,1.5,1.3),
(228,-59.50445905327797,-12.492062943056226,1.5,1.3),
(229,-13.222569832578301,-50.83697782829404,1.5,1.3),
(230,-67.27532399818301,-11.464481009170413,1.5,1.3),
(231,-29.007238382473588,-26.25499228015542,1.5,1.3),
(232,-85.74922448024154,-80.66437947563827,1.5,1.3),
(233,-60.619073966518044,83.11947612091899,1.5,1.3),
(234,47.89433665573597,-32.064516516402364,1.5,1.3),
(235,15.450885193422437,31.89017605036497,1.5,1.3),
(236,-67.9478713311255,-83.31384710036218,1.5,1.3),
(237,18.410181207582355,54.08814558759332,1.5,1.3),
(238,-23.730838112533092,73.90433042310178,1.5,1.3),
(239,56.863668421283364,44.892531260848045,1.5,1.3),
(240,-22,22,3.1,2.6),
(241,65,-22,3.1,2.6),
(242,-65,-65,3.1,2.6)
on conflict(id) do update set x=excluded.x,z=excluded.z,w=excluded.w,d=excluded.d;
create or replace function public.zion_forest_blocked(ax double precision,az double precision,bx double precision,bz double precision,pad double precision default 0)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c record;lo double precision;hi double precision;t double precision;u double precision;dx double precision:=bx-ax;dz double precision:=bz-az;
begin
 for c in select * from public.zion_forest_cover loop
  lo:=0;hi:=1;
  if abs(dx)<0.000001 then if ax<c.x-c.w-pad or ax>c.x+c.w+pad then continue;end if;
  else t:=(c.x-c.w-pad-ax)/dx;u:=(c.x+c.w+pad-ax)/dx;lo:=greatest(lo,least(t,u));hi:=least(hi,greatest(t,u));end if;
  if abs(dz)<0.000001 then if az<c.z-c.d-pad or az>c.z+c.d+pad then continue;end if;
  else t:=(c.z-c.d-pad-az)/dz;u:=(c.z+c.d+pad-az)/dz;lo:=greatest(lo,least(t,u));hi:=least(hi,greatest(t,u));end if;
  if hi>=lo then return true;end if;
 end loop;return false;
end $$;
revoke all on function public.zion_forest_blocked(double precision,double precision,double precision,double precision,double precision) from public,anon,authenticated;
create table if not exists public.zion_forest_rounds(room_id uuid primary key references public.zion_city_rooms(id) on delete cascade,ends_at timestamptz,round_no integer not null default 0);
create table if not exists public.zion_forest_fighters(room_id uuid references public.zion_city_rooms(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,hp integer not null default 100,ammo integer not null default 12,kills integer not null default 0,last_shot timestamptz not null default '-infinity',reload_at timestamptz,respawn_at timestamptz,primary key(room_id,user_id));
alter table public.zion_forest_rounds enable row level security;
alter table public.zion_forest_fighters enable row level security;
revoke all on public.zion_forest_rounds,public.zion_forest_fighters from anon,authenticated;
create or replace function public.zion_forest_command(p_room uuid,p_action text,p_x double precision,p_z double precision,p_yaw double precision,p_vehicle text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();r public.zion_city_rooms;q public.zion_forest_rounds;f public.zion_forest_fighters;
 old public.zion_city_players;target uuid;elapsed double precision;result text:='';active boolean; hit_x double precision;hit_z double precision;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and not coalesce(is_banned,false)) then raise exception 'Active login required';end if;
 select * into r from public.zion_city_rooms where id=p_room and expires_at>now() for update;
 if not found then raise exception 'Room expired';end if;
 if exists(select 1 from public.profiles where id=r.host_id and is_banned) then raise exception 'Room unavailable';end if;
 if uid<>r.host_id and not exists(select 1 from public.friendships where status='accepted' and ((requester_id=uid and addressee_id=r.host_id)or(addressee_id=uid and requester_id=r.host_id))) then raise exception 'Friend access removed';end if;
 select * into old from public.zion_city_players where room_id=p_room and user_id=uid;
 if not found then raise exception 'Join this room first';end if;
 if p_action not in ('sync','fire','reload','start') or p_action is null then raise exception 'Unknown action';end if;
 if p_x is null or p_z is null or p_yaw is null or not(p_x between -119 and 119 and p_z between -120 and 120 and p_yaw between -3.142 and 3.142) or p_vehicle is null or p_vehicle not in ('','Sedan','Motorcycle') then raise exception 'Invalid position';end if;
 insert into public.zion_forest_rounds(room_id) values(p_room) on conflict do nothing;
 insert into public.zion_forest_fighters(room_id,user_id) values(p_room,uid) on conflict do nothing;
 select * into q from public.zion_forest_rounds where room_id=p_room;
 if p_action='start' then
  if uid<>r.host_id then raise exception 'Only the host can start';end if;
  if q.ends_at>now() then raise exception 'Round already running';end if;
  if (select count(*) from public.zion_city_players where room_id=p_room and seen_at>now()-interval '15 seconds')<2 then raise exception 'Two connected players required';end if;
  update public.zion_forest_rounds set ends_at=now()+interval '3 minutes',round_no=round_no+1 where room_id=p_room returning * into q;
  insert into public.zion_forest_fighters(room_id,user_id) select p_room,user_id from public.zion_city_players where room_id=p_room on conflict do nothing;
  update public.zion_forest_fighters set hp=100,ammo=12,kills=0,reload_at=null,respawn_at=null,last_shot='-infinity' where room_id=p_room;
  result:='Round started';
 end if;
 update public.zion_forest_fighters set hp=100,ammo=12,respawn_at=null where room_id=p_room and respawn_at<=now();
 update public.zion_forest_fighters set ammo=12,reload_at=null where room_id=p_room and reload_at<=now();
 select * into f from public.zion_forest_fighters where room_id=p_room and user_id=uid;
 elapsed:=least(1,greatest(0,extract(epoch from now()-old.seen_at)));
 if f.hp>0 and sqrt(power(p_x-old.x,2)+power(p_z-old.z,2))<=30*elapsed+0.75 and not public.zion_forest_blocked(old.x,old.z,p_x,p_z,case when p_vehicle='' then 0.5 else 1.6 end) then
  update public.zion_city_players set x=p_x,z=p_z,yaw=p_yaw,vehicle=p_vehicle,seen_at=now() where room_id=p_room and user_id=uid;
 else update public.zion_city_players set seen_at=now() where room_id=p_room and user_id=uid; p_x:=old.x;p_z:=old.z;p_yaw:=old.yaw;end if;
 active:=q.ends_at>now();
 if p_action in ('fire','reload') and (not coalesce(active,false) or f.hp<=0) then result:='Wait for an active round and respawn';
 elsif p_action='reload' and f.reload_at is null and f.ammo<12 then
  update public.zion_forest_fighters set reload_at=now()+interval '1.2 seconds' where room_id=p_room and user_id=uid;result:='Reloading';
 elsif p_action='fire' and f.reload_at is null and f.ammo>0 and f.last_shot<now()-interval '300 milliseconds' and p_vehicle='' then
  update public.zion_forest_fighters set ammo=ammo-1,last_shot=now() where room_id=p_room and user_id=uid;
  -- Server chooses the nearest target along the player's facing direction.
  select p.user_id,p.x,p.z into target,hit_x,hit_z from public.zion_city_players p join public.zion_forest_fighters c on c.room_id=p.room_id and c.user_id=p.user_id join public.profiles a on a.id=p.user_id
  where p.room_id=p_room and p.user_id<>uid and c.hp>0 and not coalesce(a.is_banned,false) and p.seen_at>now()-interval '5 seconds'
   and (p.x-p_x)*sin(p_yaw)+(p.z-p_z)*cos(p_yaw) between 0.5 and 45
   and abs((p.x-p_x)*cos(p_yaw)-(p.z-p_z)*sin(p_yaw))<0.65
  order by power(p.x-p_x,2)+power(p.z-p_z,2) limit 1;
  if target is not null and not public.zion_forest_blocked(p_x,p_z,hit_x,hit_z,0) then
   update public.zion_forest_fighters set hp=greatest(0,hp-25),respawn_at=case when hp<=25 then now()+interval '5 seconds' else null end where room_id=p_room and user_id=target;
   if exists(select 1 from public.zion_forest_fighters where room_id=p_room and user_id=target and hp=0) then update public.zion_forest_fighters set kills=kills+1 where room_id=p_room and user_id=uid;result:='Elimination';else result:='Hit';end if;
  else result:='Miss';end if;
 end if;
 return jsonb_build_object('message',result,'round',jsonb_build_object('number',q.round_no,'ends_at',q.ends_at,'active',coalesce(active,false),'host',r.host_id=uid),'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',a.username,'x',p.x,'z',p.z,'yaw',p.yaw,'vehicle',p.vehicle,'hp',c.hp,'ammo',c.ammo,'kills',c.kills,'respawn_at',c.respawn_at)) from public.zion_city_players p join public.profiles a on a.id=p.user_id join public.zion_forest_fighters c on c.room_id=p.room_id and c.user_id=p.user_id where p.room_id=p_room and p.seen_at>now()-interval '15 seconds' and not coalesce(a.is_banned,false)),'[]'::jsonb));
end $$;
revoke all on function public.zion_forest_command(uuid,text,double precision,double precision,double precision,text) from public,anon;
grant execute on function public.zion_forest_command(uuid,text,double precision,double precision,double precision,text) to authenticated;
-- Prevent old clients bypassing validated movement through the former position RPC.
revoke execute on function public.zion_city_sync(uuid,double precision,double precision,double precision,text) from public,anon,authenticated;
commit;
