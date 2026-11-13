"""Tests unitaires du calcul Elo : python -m pytest"""
from datetime import date

import pytest

from app import elo
from app.elo import Result


def test_equal_teams_have_50_percent():
    assert elo.expected_score(1500, 1500) == pytest.approx(0.5)


def test_400_points_gap_gives_about_91_percent():
    assert elo.expected_score(1900, 1500) == pytest.approx(10 / 11)


def test_goal_multiplier():
    assert elo.goal_multiplier(1) == 1
    assert elo.goal_multiplier(-2) == 1.5
    assert elo.goal_multiplier(3) == pytest.approx(14 / 8)


def test_win_between_equal_teams_moves_16_points_and_is_zero_sum():
    teams = elo.compute([Result(1, team1_id=10, team2_id=20, goals1=1, goals2=0)])
    assert teams[10].rating == pytest.approx(1516)
    assert teams[20].rating == pytest.approx(1484)
    assert teams[10].rating + teams[20].rating == pytest.approx(3000)


def test_draw_between_equal_teams_changes_nothing():
    teams = elo.compute([Result(1, 10, 20, 2, 2)])
    assert teams[10].rating == pytest.approx(1500)
    assert teams[10].draws == teams[20].draws == 1
    assert teams[10].points == 1


def test_upset_earns_more_than_expected_win():
    # 10 bat 20 deux fois (10 devient favori), puis 30 (nouveau) bat 10 ou 20
    base = [Result(1, 10, 20, 1, 0, date(2027, 1, 1)), Result(2, 10, 20, 1, 0, date(2027, 1, 2))]
    beat_favorite = elo.compute(base + [Result(3, 30, 10, 1, 0, date(2027, 1, 3))])[30].rating - 1500
    beat_underdog = elo.compute(base + [Result(3, 30, 20, 1, 0, date(2027, 1, 3))])[30].rating - 1500
    assert beat_favorite > beat_underdog > 0


def test_stats_form_and_history_follow_dates_not_ids():
    results = [
        Result(2, 10, 20, 0, 3, date(2027, 1, 5)),   # défaite, jouée en 2e
        Result(1, 10, 20, 2, 1, date(2027, 1, 1)),   # victoire, jouée en 1er
    ]
    t = elo.compute(results)[10]
    assert t.form == "VD"
    assert [h["match_id"] for h in t.history] == [1, 2]
    assert (t.played, t.wins, t.losses, t.goals_for, t.goals_against, t.goal_difference) == (2, 1, 1, 2, 4, -2)


def test_rank_by_points_then_goal_difference():
    teams = elo.compute([
        Result(1, 10, 20, 5, 0),
        Result(2, 30, 40, 1, 0),
    ])
    ordered = [t.team_id for t in elo.rank(teams, "points")]
    assert ordered[:2] == [10, 30]  # même nombre de points, 10 a une meilleure différence
